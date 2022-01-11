//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Main                            = imports.ui.main;
const {Clutter, Gdk, Gtk, GLib, Meta} = imports.gi;

const Me               = imports.misc.extensionUtils.getCurrentExtension();
const utils            = Me.imports.src.common.utils;
const DBusInterface    = Me.imports.src.common.DBusInterface.DBusInterface;
const InputManipulator = Me.imports.src.common.InputManipulator.InputManipulator;
const Statistics       = Me.imports.src.common.Statistics.Statistics;
const Timer            = Me.imports.src.common.Timer.Timer;
const Background       = Me.imports.src.extension.Background.Background;
const MenuItem         = Me.imports.src.extension.MenuItem.MenuItem;
const SelectionWedges  = Me.imports.src.extension.SelectionWedges.SelectionWedges;
const MenuItemState    = Me.imports.src.extension.MenuItem.MenuItemState;

//////////////////////////////////////////////////////////////////////////////////////////
// The Menu parses the JSON structure given to the ShowMenu method. It creates          //
// MenuItems accordingly. It keeps a list of currently selected MenuItems and, based on //
// the selection events from the SelectionWedges, it manages the state changes of the   //
// individual MenuItems in the hierarchy.                                               //
//////////////////////////////////////////////////////////////////////////////////////////

var Menu = class Menu {

  // ------------------------------------------------------------ constructor / destructor

  // The Menu is only instantiated once by the Daemon. It is re-used for each new incoming
  // ShowMenu request. The four parameters are callbacks which are fired when the
  // corresponding event occurs.
  constructor(
      settings, emitHoverSignal, emitUnhoverSignal, emitSelectSignal, emitCancelSignal) {

    // Create Gio.Settings object for org.gnome.shell.extensions.flypie.
    this._settings = settings;

    // This is primarily for the statistics.
    this._timer = new Timer();

    // Store the callbacks.
    this._emitHoverSignal   = emitHoverSignal;
    this._emitUnhoverSignal = emitUnhoverSignal;
    this._emitSelectSignal  = emitSelectSignal;
    this._emitCancelSignal  = emitCancelSignal;

    // This holds the ID of the currently active menu. It's null if no menu is currently
    // shown.
    this._menuID = null;

    // If a display-timeout is configured, the menu is only shown when the pointer is
    // stationary for some time. Here we restart the timeout if it is currently pending.
    // This member stores the timeout ID.
    this._displayTimeoutID = -1;

    // Stores a reference to the MenuItem which is currently dragged around while a
    // gesture is performed.
    this._draggedChild = null;

    // This is a list of active MenuItems. At the beginning it will contain the root
    // MenuItem only. Selected children deeper in the hierarchy are prepended to this
    // list. This means, the currently active menu node is always _menuPath[0].
    this._menuPath = [];

    // This is used to warp the mouse pointer at the edges of the screen if necessary.
    this._input = new InputManipulator();

    // This will contain the latest pointer location, similar to the value returned by
    // global.get_pointer(). However, it is not limited to the mouse pointer position but
    // works for as well for stylus or touch input.
    this._pointerPos = [0, 0];

    // This will contain the Clutter.InputDevice which controls an extra cursor (such as a
    // stylus) if it was used most recently by the user. We will try to open the menu at
    // the current position of this device.
    this._lastNonPointerDevice = null;

    // When the menu is opened, we cannot directly get the position of the
    // _lastNonPointerDevice (as Clutter.Seat.query_device_state() is not available).
    // Therefore we wait for the next ENTER event for this device and move the menu to the
    // position given by this event.
    this._initialRepositioningRequired = false;

    // The background covers the entire screen. Usually it's transparent and thus
    // invisible but once a menu is shown, it will be pushed as modal capturing the
    // complete user input. The color of the then visible background can be configured via
    // the settings. Input is handled by the involved classes mostly like this:
    //   .------------.     .-----------------.     .------.     .-----------.
    //   | Background | --> | SelectionWedges | --> | Menu | --> | MenuItems |
    //   '------------'     '-----------------'     '------'     '-----------'
    // The Background captures all button and motion events which are then forwarded to
    // the SelectionWedges. The SelectionWedges compute the currently active wedge and
    // emit signals indicating any change. These change events are then passed from the
    // Menu to the individual MenuItems.
    this._background = new Background();
    Main.layoutManager.addChrome(this._background);

    // Here we store the Clutter.InputDevice which controls an extra cursor if it was used
    // most recently by the user. We will try to open the menu at the current position of
    // this device later.
    this._deviceChangedID =
        Meta.get_backend().connect('last-device-changed', (b, device) => {
          // Multi-cursor stuff only works on Wayland. For now, I assume that tablets,
          // pens and erasers create a secondary cursor. Is this true?
          if (utils.getSessionType() == 'wayland') {
            if (device.get_device_type() == Clutter.InputDeviceType.TABLET_DEVICE ||
                device.get_device_type() == Clutter.InputDeviceType.PEN_DEVICE ||
                device.get_device_type() == Clutter.InputDeviceType.ERASER_DEVICE) {

              this._lastNonPointerDevice = device;

            }
            // For all other pointer-input devices, we use the main mouse pointer
            // location.
            else if (
                device.get_device_type() == Clutter.InputDeviceType.POINTER_DEVICE ||
                device.get_device_type() == Clutter.InputDeviceType.TOUCHPAD_DEVICE ||
                device.get_device_type() == Clutter.InputDeviceType.TOUCHSCREEN_DEVICE) {

              this._lastNonPointerDevice = null;
            }
          }
        });

    // This is called further below in various cases. It is not only called on real button
    // release events but also on semantically similar events such as touch end events.
    const emitSelection = (coords) => {
      // Forward button release events to the SelectionWedges.
      // This will potentially fire the OnSelect signal.
      this._selectionWedges.emitSelection(coords);
      // This is for the statistics only: As the mouse button was released, any further
      // (final) selections will not be gesture-only selections.
      this._gestureOnlySelection = false;
    };

    // We connect to the generic "event" event and handle all kinds of events in there.
    this._background.connect('event', (actor, event) => {
      // Store the latest input position.
      if (event.type() == Clutter.EventType.MOTION ||
          event.type() == Clutter.EventType.TOUCH_UPDATE ||
          event.type() == Clutter.EventType.ENTER) {
        this._pointerPos = event.get_coords();

        // Cancel any pending long-press event if the pointer moved too much.
        if (this._longPressTimeout >= 0 &&
            !this._isInDragThreshold(this._pointerPos, this._clickStartPos)) {
          GLib.source_remove(this._longPressTimeout);
          this._longPressTimeout = -1;
        }
      }

      // If we have to open the menu at a secondary pointer (e.g. from a stylus), we use
      // this enter event to position the menu.
      if (event.type() == Clutter.EventType.ENTER && this._lastNonPointerDevice &&
          this._initialRepositioningRequired) {
        if (event.get_device().get_device_name() ===
            this._lastNonPointerDevice.get_device_name()) {
          this._setPosition(this._pointerPos[0], this._pointerPos[1], false);
          this._initialRepositioningRequired = false;
        }
      }

      // If a modifier key is released while an item is dragged around, this can lead to
      // a selection in "Turbo Mode".
      if (event.type() == Clutter.EventType.KEY_RELEASE) {
        if (this._draggedChild != null) {

          // This seems kind-of hard-coded... Is there a better way to test whether the
          // released key was a modifier key?
          if (event.get_key_symbol() == Clutter.KEY_Control_L ||
              event.get_key_symbol() == Clutter.KEY_Control_R ||
              event.get_key_symbol() == Clutter.KEY_Shift_L ||
              event.get_key_symbol() == Clutter.KEY_Shift_R ||
              event.get_key_symbol() == Clutter.KEY_Alt_L ||
              event.get_key_symbol() == Clutter.KEY_Alt_R ||
              event.get_key_symbol() == Clutter.KEY_Super_L ||
              event.get_key_symbol() == Clutter.KEY_Super_R) {
            emitSelection(this._pointerPos);
          }
        }
        return Clutter.EVENT_STOP;
      }

      if (event.type() == Clutter.EventType.BUTTON_PRESS ||
          event.type() == Clutter.EventType.TOUCH_BEGIN) {

        // Store the position where the click started. If the pointer is not moved too,
        // much, this may become a long-press. This is also used for right-mouse-button
        // cancelling.
        this._clickStartPos = this._pointerPos;

        // If the user touches / clicks on the screen, we start a long-press timer. This
        // is canceled if the pointer is moved to far or if the button / touch is released
        // again. On touch-based clicks, get_button() returns 0.
        if (event.get_button() == 0 || event.get_button() == 1) {
          const delay = Clutter.Settings.get_default().long_press_duration;

          this._longPressTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
            this.cancel();
            this.close();
            this._longPressTimeout = -1;
          });
        }
      }

      // Forward button release events to the selection wedges.
      // Touch-end events are handled as if the left mouse button was released.
      if (event.type() == Clutter.EventType.BUTTON_RELEASE ||
          event.type() == Clutter.EventType.TOUCH_END) {

        // Cancel any pending long-press.
        if (this._longPressTimeout >= 0) {
          GLib.source_remove(this._longPressTimeout);
          this._longPressTimeout = -1;
        }

        // Cancel the menu on right-button presses, but only if the pointer did not move
        // too much.
        if (event.get_button() == 3 && this._clickStartPos &&
            this._isInDragThreshold(this._pointerPos, this._clickStartPos)) {
          this.cancel();
          this.close();
          return Clutter.EVENT_STOP;
        }

        // Only emit selection events if no modifier buttons are still held down. Without,
        // the main issue is that releasing the Super key after the Fly-Pie menus has been
        // closed would lead to toggling the overview.
        const turboModifiers =
            Gtk.accelerator_get_default_mod_mask() | Clutter.ModifierType.MOD4_MASK;

        if ((event.get_state() & turboModifiers) == 0) {
          emitSelection(event.get_coords());
        }
        return Clutter.EVENT_STOP;
      }

      // Hide the menu when the escape key is pressed.
      if (event.type() == Clutter.EventType.KEY_PRESS) {
        if (event.get_key_symbol() == Clutter.KEY_Escape && this._menuID != null) {
          this.cancel();
          this.close();
        }
        return Clutter.EVENT_STOP;
      }

      // Forward motion events to the SelectionWedges. If the primary mouse button is
      // pressed, this will also drag the currently active child around.
      if (event.type() == Clutter.EventType.MOTION ||
          event.type() == Clutter.EventType.TOUCH_UPDATE) {

        // If a display-timeout is configured, the menu is only shown when the pointer is
        // stationary for some time. Here we restart the timeout if it is currently
        // pending.
        if (this._displayTimeoutID >= 0) {
          GLib.source_remove(this._displayTimeoutID);
          this._revealDelayed();
        }

        // Forward the motion event to the selection wedges.
        this._selectionWedges.onMotionEvent(event.get_coords(), event.get_state());

        // If the primary button is pressed or a modifier is held down (for the
        // "Turbo-Mode"), but we do not have a dragged child yet, we mark the currently
        // hovered child as being the dragged child.
        if ((this._selectionWedges.isGestureModifier(event.get_state())) &&
            this._draggedChild == null) {
          const index = this._selectionWedges.getHoveredChild();
          if (index >= 0) {
            const child = this._menuPath[0].getChildMenuItems()[index];
            child.setState(MenuItemState.CHILD_DRAGGED);
            this._draggedChild = child;
          }
        }

        // If there is a dragged child, update its position.
        if (this._draggedChild != null) {

          // This is for the statistics only: If this is the first gesture during the
          // current selection, we set this member to true. It will be set to false as
          // soon as the mouse button is released again.
          if (this._gestureOnlySelection == null) {
            this._gestureOnlySelection = true;
          }

          // Transform event coordinates to parent-relative coordinates.
          let ok, x, y;
          [x, y]       = event.get_coords();
          const parent = this._draggedChild.get_parent().get_parent();
          [ok, x, y]   = parent.transform_stage_point(x, y);

          // Set the child's position without any transition.
          this._draggedChild.set_easing_duration(0);
          this._draggedChild.set_translation(x, y, 0);

          // Draw the parent's trace to this position.
          parent.drawTrace(x, y, 0, 0);
        }

        return Clutter.EVENT_STOP;
      }

      return Clutter.EVENT_CONTINUE;
    });

    // Delete the currently active menu once the background was faded-out.
    this._background.connect('transitions-completed', () => {
      if (this._background.opacity == 0 && this._root) {
        this._root.destroy();
        this._root = null;
      }
    });

    // This is fired when the close button of the preview mode is clicked.
    this._background.connect('close-event', () => {
      this.cancel();
      this.close();
    });

    // All interaction with the menu happens through the SelectionWedges. They receive
    // motion and button events and emit selection signals based on this input. When these
    // signals are emitted, the state of all MenuItems is changed accordingly. For a full
    // description of the SelectionWedge have a look at their file. Here is a quick
    // summary of the signals:
    // child-hovered-event:    When the mouse pointer enters one of the wedges.
    // child-selected-event:   When the primary mouse button is pressed inside a wedge.
    // parent-hovered-event:   Same as child-hovered-event, but for the parent wedge.
    // parent-selected-event:  Same as child-selected-event, but for the parent wedge.
    // cancel-selection-event: When the secondary mouse button is pressed.
    this._selectionWedges = new SelectionWedges();
    this._background.add_child(this._selectionWedges);

    // This is fired when the mouse pointer enters one of the wedges.
    this._selectionWedges.connect('child-hovered-event', (o, hoveredIndex) => {
      // If there is a currently hovered child, we will call the unhover signal later.
      const unhoveredIndex = this._menuPath[0].getActiveChildIndex();

      // If no child is hovered (hoveredIndex == -1), the center element is hovered.
      if (hoveredIndex == -1) {
        this._menuPath[0].setState(MenuItemState.CENTER_HOVERED, -1);
      } else {
        this._menuPath[0].setState(MenuItemState.CENTER, hoveredIndex);
      }

      // It could be that the parent of the currently active item was hovered before, so
      // lets set its state back to PARENT.
      if (this._menuPath.length > 1) {
        this._menuPath[1].setState(MenuItemState.PARENT);
      }

      // If we're currently dragging a child around, the newly hovered child will
      // instantaneously become the hovered child.
      const mods = global.get_pointer()[2];
      if (this._selectionWedges.isGestureModifier(mods) && hoveredIndex >= 0) {
        const child = this._menuPath[0].getChildMenuItems()[hoveredIndex];
        child.setState(MenuItemState.CHILD_DRAGGED);
        this._draggedChild = child;
      } else {
        this._draggedChild = null;
      }

      // Report the unhover event on the D-Bus if an action was hovered before.
      this._unhoverChild(unhoveredIndex);

      // Report the hover event on the D-Bus if an action is hovered.
      if (hoveredIndex >= 0) {
        const child = this._menuPath[0].getChildMenuItems()[hoveredIndex];

        // If the item has a selection callback, it is an action.
        if (child.getSelectionCallback() != null) {

          // If the action has a hover callback, call it!
          if (child.getHoverCallback() != null) {
            child.getHoverCallback()();
          }

          // Then emit the D-Bus hover signal!
          this._emitHoverSignal(this._menuID, child.id);
        }
      }

      // This recursively redraws all children based on their newly assigned state.
      this._root.redraw();
    });

    // This is fired when the primary mouse button is pressed inside a wedge. This will
    // also be emitted when a gesture is detected.
    this._selectionWedges.connect('child-selected-event', (o, index, gesture, x, y) => {
      const parent = this._menuPath[0];
      const child  = this._menuPath[0].getChildMenuItems()[index];

      // Ignore any gesture-based selection of leaf nodes. Final selections are only done
      // when the mouse button or a modifier button is released. An exception is the
      // experimental hover mode in which we also allow selections by gestures.
      const hoverMode = this._settings.get_boolean('hover-mode');
      if (gesture && !hoverMode && child.getChildMenuItems().length == 0) {
        return;
      }

      // Once something is selected, it's not dragged anymore. Even if the mouse button is
      // still pressed (we might come here when a gesture was detected by the
      // SelectionWedges), we abort any dragging operation.
      this._draggedChild = null;

      // Update the item states: The previously active item becomes the parent, the
      // selected child becomes the new hovered center item.
      parent.setState(MenuItemState.PARENT, index);
      child.setState(MenuItemState.CENTER_HOVERED);

      // Prepend the newly active item to our menu selection chain.
      this._menuPath.unshift(child);

      // The newly active item will be shown at the pointer position. To prevent it from
      // going offscreen, we clamp the position to the current monitor bounds (we do it
      // removing background boundaries from mouse pointer).
      const [clampedX, clampedY] =
          this._clampToToMonitor(x - this._background.x, y - this._background.y, 10);

      // Warp the mouse pointer to this position if necessary accounting background
      // position as well.
      if (x != clampedX || y != clampedY) {
        this._input.warpPointer(
            clampedX + this._background.x, clampedY + this._background.y);
      }

      // Move the child to the target position accounting background position as well.
      const [ok, relativeX, relativeY] = parent.transform_stage_point(clampedX, clampedY);
      child.set_translation(
          relativeX + this._background.x, relativeY + this._background.y, 0);

      // The "trace" of the menu needs to be "idealized". That means, even if the user did
      // not click exactly in the direction of the item, the line connecting parent and
      // child has to be drawn with the correct angle. As the newly active item will be
      // shown directly at the pointer position, we must move the parent so that the trace
      // has the correct angle. Actually not the parent item has to move but the root of
      // the entire menu selection chain.
      this._idealizeTace(clampedX + this._background.x, clampedY + this._background.y);

      // Now we update position and the number of wedges of the SelectionWedges
      // according to the newly active item.
      const itemAngles = [];
      child.getChildMenuItems().forEach(item => {
        itemAngles.push(item.angle);
      });

      this._selectionWedges.setItemAngles(itemAngles, (child.angle + 180) % 360);
      this._selectionWedges.set_translation(clampedX, clampedY, 0);

      // This recursively redraws all children based on their newly assigned state.
      this._root.redraw();

      // Finally, if a child was selected which is activatable, we report a selection and
      // hide the entire menu.
      this._selectChild(child);
    });

    // When a parent item is hovered, we draw the currently active item with the state
    // CENTER_HOVERED to indicate that the parent is not a child.
    this._selectionWedges.connect('parent-hovered-event', () => {
      // If there is a currently hovered child, we may have to call the unhover signal.
      const unhoveredIndex = this._menuPath[0].getActiveChildIndex();
      this._unhoverChild(unhoveredIndex);

      this._menuPath[0].setState(MenuItemState.CENTER_HOVERED, -1);
      this._menuPath[1].setState(MenuItemState.PARENT_HOVERED);

      // This recursively redraws all children based on their newly assigned state.
      this._root.redraw();

      // Parent items cannot be dragged around. Even if the mouse button is still pressed
      // (we might come here when a gesture was detected by the SelectionWedges), we abort
      // any dragging operation.
      this._draggedChild = null;
    });

    // If the parent of the currently active item is selected, it becomes the newly active
    // item with the state CENTER_HOVERED.
    this._selectionWedges.connect('parent-selected-event', (o, gesture, x, y) => {
      const parent = this._menuPath[1];
      parent.setState(MenuItemState.CENTER_HOVERED, -1);

      // Remove the first element of the menu selection chain.
      this._menuPath.shift();

      // The parent item will be moved to the pointer position. To prevent it from
      // going offscreen, we clamp the position to the current monitor bounds (we do it
      // removing background boundaries from mouse pointer).
      const [clampedX, clampedY] =
          this._clampToToMonitor(x - this._background.x, y - this._background.y, 10);

      // Warp the mouse pointer to this position if necessary accounting background
      // position as well.
      if (x != clampedX || y != clampedY) {
        this._input.warpPointer(
            clampedX + this._background.x, clampedY + this._background.y);
      }

      // The "trace" of the menu needs to be "idealized". That means, even if the user did
      // not click exactly in the direction of the item, the line connecting parent and
      // child has to be drawn with the correct angle. As the newly active item will be
      // shown directly at the pointer position, we must move the parent so that the trace
      // has the correct angle. Actually not the parent item has to move but the root of
      // the entire menu selection chain.
      this._idealizeTace(clampedX + this._background.x, clampedY + this._background.y);

      // Now we update position and the number of wedges of the SelectionWedges
      // according to the newly active item.
      const itemAngles = [];
      parent.getChildMenuItems().forEach(item => {
        itemAngles.push(item.angle);
      });

      // If necessary, add a wedge for the parent's parent.
      if (this._menuPath.length > 1) {
        this._selectionWedges.setItemAngles(itemAngles, (parent.angle + 180) % 360);
      } else {
        this._selectionWedges.setItemAngles(itemAngles);
      }

      this._selectionWedges.set_translation(clampedX, clampedY, 0);

      // Once the parent is selected, nothing is dragged anymore. Even if the mouse button
      // is still pressed (we might come here when a gesture was detected by the
      // SelectionWedges), we abort any dragging operation.
      this._draggedChild = null;

      // This recursively redraws all children based on their newly assigned state.
      this._root.redraw();
    });

    // This is usually fired when the right mouse button is pressed.
    this._selectionWedges.connect('cancel-selection-event', () => {
      this.cancel();
      this.close();
    });

    this.onSettingsChange();
  }

  // This removes our root actor from GNOME Shell and disconnects various handlers and
  // timeouts.
  destroy() {
    this.close();
    Main.layoutManager.removeChrome(this._background);
    this._background.destroy();
    Meta.get_backend().disconnect(this._deviceChangedID);
    this._cancelMoveWindowToPointer();
  }

  // -------------------------------------------------------------------- public interface

  // Returns the ID of the currently visible menu. Will be null if no menu is currently
  // shown.
  getID() {
    return this._menuID;
  }

  // This shows the menu, or updates the menu if it is already visible. If the pixel
  // positions x and y are given, the menu will be shown at this position. Returns an
  // error code if something went wrong. See DBusInerface.js for all possible error codes.
  open(menuID, structure, previewMode, x, y) {

    // The menu is already active. Try to update the existing menu according to the new
    // structure and if that is successful, emit an onCancel signal for the current menu.
    if (this._menuID != null) {
      const result = this.update(structure);

      if (result < 0) {
        return result;
      }

      // Emit a cancel event for the currently active menu and store the new ID.
      this._emitCancelSignal(this._menuID);
      this._menuID = menuID;

      // Update the preview-mode state of the background.
      this._background.open(previewMode);

      return this._menuID;
    }

    // Remove any previous menus.
    if (this._root) {
      this._root.destroy();
    }

    // Ascertain several properties of the menu structure. This assigns IDs and angles to
    // each and every item.
    const result = this._normalizeMenuStructure(structure);
    if (result < 0) {
      return result;
    }

    // Show the background actor.
    this._background.open(previewMode);

    // Everything seems alright, start opening the menu!
    this._menuID = menuID;

    // This is used for tracking click-events and long-press-events.
    this._clickStartPos = null;

    // This is only for the statistics. This will be set to true at the first drag motion
    // and to false as soon as the mouse button is released without selecting something.
    this._gestureOnlySelection = null;
    this._timer.reset();

    // Create all visible Clutter.Actors for the items.
    const createMenuItem = (item) => {
      const menuItem = new MenuItem({
        id: item.id,
        name: item.name,
        icon: item.icon,
        angle: item.angle,
      });

      if (item.children) {
        // Recursively continue for all children.
        item.children.forEach(child => {
          menuItem.addMenuItem(createMenuItem(child));
        });

      } else {

        // If there are no children, there may be a selection, a hover, or an unhover
        // callback. We forward them to the item so that they can be called if required.
        if (item.onSelect) {
          menuItem.setSelectionCallback(item.onSelect);
        }

        if (item.onHover) {
          menuItem.setHoverCallback(item.onHover);
        }

        if (item.onUnhover) {
          menuItem.setUnhoverCallback(item.onUnhover);
        }
      }

      return menuItem;
    };

    this._root = createMenuItem(structure);
    this._background.add_child(this._root);

    this._menuPath.push(this._root);

    this._root.setState(MenuItemState.CENTER_HOVERED, -1);
    this._root.onSettingsChange(this._settings);
    this._root.redraw();

    // Initialize the wedge angles of the SelectionWedges according to the root menu.
    const itemAngles = [];
    this._root.getChildMenuItems().forEach(item => {
      itemAngles.push(item.angle);
    });
    this._selectionWedges.setItemAngles(itemAngles);

    // Calculate menu position. We open the menu in the middle of the screen if necessary
    // accounting background position as well. Else we position it at the mouse pointer
    // accounting background position as well.
    if (previewMode || structure.centered) {
      const posX = this._background.width / 2;
      const posY = this._background.height / 2;
      this._root.set_translation(posX, posY, 0);
      this._selectionWedges.set_translation(posX, posY, 0);

      if (!previewMode) {
        this._input.warpPointer(posX + this._background.x, posY + this._background.y);
      }
    } else {

      // Use mouse pointer location if no coordinates are given. In many cases, this will
      // be correct, however, the user may be using touch input, a tablet or something
      // completely different. Therefore we set _initialRepositioningRequired to true and
      // attempt to reposition the menu in the next ENTER event.
      if (x != null && y != null) {
        this._setPosition(x, y, true);
      } else if (this._lastNonPointerDevice != null) {
        this._initialRepositioningRequired = true;
      } else {
        [x, y] = global.get_pointer();
        this._setPosition(x, y, true);
      }
    }

    // If a display-timeout is configured and we are not in preview mode, the menu is only
    // shown when the pointer is stationary for some time. Here we restart the timeout if
    // it is currently pending.
    if (previewMode) {
      this._reveal();
    } else {
      this._revealDelayed();
    }

    return this._menuID;
  }

  // This makes a given item the currently selected item. The given path should be
  // something like "/0/1" which would mean that the second child of the first child item
  // will be selected. Passing "/" will select the root item. If an invalid path is given,
  // DBusInterface.errorCodes.eInvalidPath will be returned. If currently no menu is
  // shown, DBusInterface.errorCodes.eNoActiveMenu will be returned.
  selectItem(path) {

    // Check whether a menu is currently visible.
    if (this._menuID == null) {
      return DBusInterface.errorCodes.eNoActiveMenu;
    }

    // The path should start with a '/'.
    if (path.length == 0 || path[0] != '/') {
      return DBusInterface.errorCodes.eInvalidPath;
    }

    // Remove first slash.
    path = path.substring(1);

    // Remove trailing slash (if any).
    if (path[path.length - 1] == '/') {
      path = path.substring(0, path.length - 1);
    }

    // Split at "/" and convert to numbers.
    let items = [];
    if (path.length > 0) {
      items = path.split('/').map((x) => parseInt(x));
    }

    // Let's try to construct the menu path accordingly.
    let newMenuPath = [this._root];

    for (let i = 0; i < items.length; i++) {
      const index = items[i];
      if (index < newMenuPath[0].getChildMenuItems().length) {
        newMenuPath.unshift(newMenuPath[0].getChildMenuItems()[index]);
      } else {
        return DBusInterface.errorCodes.eInvalidPath;
      }
    }

    // If there is a currently hovered child, we may have to call the unhover signal.
    const unhoveredIndex = this._menuPath[0].getActiveChildIndex();
    this._unhoverChild(unhoveredIndex);

    // We will make the newly selected item to move to the same position as the previously
    // selected item.
    let [x, y] = this._menuPath[0].get_transformed_position();

    // The call above may return NaN in some cases. I think this happens when the menu has
    // never been drawn and the selectItem() method is directly called after the show()
    // method.
    if (isNaN(x)) x = this._menuPath[0].translation_x + this._background.x;
    if (isNaN(y)) y = this._menuPath[0].translation_y + this._background.y;

    // Store the new menu path.
    this._menuPath = newMenuPath;

    // And redraw everything.
    this._resetState(x, y);

    // Finally, if the selected item is activatable, we report a selection and hide the
    // entire menu.
    this._selectChild(this._menuPath[0]);

    return 0;
  }

  // Hides the menu and the background actor.
  close() {

    // The menu is not active; nothing to be done.
    if (this._menuID == null) {
      return;
    }

    // Cancel the timeouts.
    if (this._displayTimeoutID >= 0) {
      GLib.source_remove(this._displayTimeoutID);
      this._displayTimeoutID = -1;
    }

    if (this._longPressTimeout >= 0) {
      GLib.source_remove(this._longPressTimeout);
      this._longPressTimeout = -1;
    }

    // Fade out the background actor. Once this transition is completed, the _root item
    // will be destroyed by the background's "transitions-completed" signal handler.
    this._background.close();

    // Rest menu ID. With this set to null, we can accept new menu requests.
    this._menuID = null;

    // Reset some other members.
    this._draggedChild = null;
    this._menuPath     = [];
  }

  // Emits the DBus-Cancel signal and potentially an unhover signal for the currently
  // hovered item (if any).
  cancel() {
    const index = this._selectionWedges.getHoveredChild();
    if (index >= 0) {
      const child = this._menuPath[0].getChildMenuItems()[index];

      // If the item has a selection callback, it is an action.
      if (child.getSelectionCallback() != null) {
        // If the action has an unhover callback, we call it before. This is to ensure
        // that there are always pairs of hover / unhover events.
        if (child.getUnhoverCallback() != null) {
          child.getUnhoverCallback()();
        }

        // Then emit the D-Bus unhover signal!
        this._emitUnhoverSignal(this._menuID, child.id);
      }
    }

    this._emitCancelSignal(this._menuID);
  }

  // This is called when the menu configuration is changed while the menu is open. We
  // should adapt the open menu accordingly. This is primarily meant for the preview mode
  // of Fly-Pie's menu editor.
  // Usually, at most one property of an item will be changed (name or icon). If both
  // changed, it's quite likely that an item was added, removed or moved. But actually
  // we don't know, so this guess will not be correct in all cases.
  // It will return 0 on success and an error code < 0 on failure.
  update(structure) {

    // First make sure that all properties of the given menu structure are set correctly.
    const result = this._normalizeMenuStructure(structure);
    if (result < 0) {
      return result;
    }

    // This is called recursively for all items of the new menu structure. The second
    // parameter is the corresponding MenuItem of the currently open menu. If no
    // corresponding item exists, this will be a newly created MenuItem.
    const updateMenuItem = (newConfig, item) => {
      item.id    = newConfig.id;
      item.name  = newConfig.name;
      item.icon  = newConfig.icon;
      item.angle = newConfig.angle;
      item.setSelectionCallback(newConfig.onSelect || null);
      item.setHoverCallback(newConfig.onHover || null);
      item.setUnhoverCallback(newConfig.onUnhover || null);

      const children = new Set(item.getChildMenuItems());

      if (newConfig.children) {

        // First, we iterate through all new children an try to find for each an old child
        // with the same name and icon. If one exists, this is used for the new child.
        newConfig.children.forEach(newChild => {
          for (let child of children) {
            if (child.name == newChild.name && child.icon == newChild.icon) {
              newChild.matchingChild = child;
              children.delete(child);
              break;
            }
          }
        });

        // Then, for each new child which does not have a corresponding old child
        // assigned, we try to find one for which at least the name or the icon is the
        // same.
        newConfig.children.forEach(newChild => {
          if (newChild.matchingChild == undefined) {
            for (let child of children) {
              if (child.name == newChild.name || child.icon == newChild.icon) {
                newChild.matchingChild = child;
                children.delete(child);
                break;
              }
            }
          }
        });

        // And new MenuItems are created for those new children which do not have a
        // corresponding old MenuItem. For all others, all settings are updated.
        newConfig.children.forEach(newChild => {
          if (newChild.matchingChild == undefined) {
            newChild.matchingChild = new MenuItem({
              id: newChild.id,
              name: newChild.name,
              icon: newChild.icon,
              angle: newChild.angle,
            });
            newChild.matchingChild.setSelectionCallback(newConfig.onSelect || null);
            newChild.matchingChild.setHoverCallback(newConfig.onHover || null);
            newChild.matchingChild.setUnhoverCallback(newConfig.onUnhover || null);
            item.addMenuItem(newChild.matchingChild);
            newChild.matchingChild.onSettingsChange(this._settings);

          } else {
            newChild.matchingChild.id    = newChild.id;
            newChild.matchingChild.name  = newChild.name;
            newChild.matchingChild.icon  = newChild.icon;
            newChild.matchingChild.angle = newChild.angle;
            newChild.matchingChild.setSelectionCallback(newConfig.onSelect || null);
            newChild.matchingChild.setHoverCallback(newConfig.onHover || null);
            newChild.matchingChild.setUnhoverCallback(newConfig.onUnhover || null);
          }
        });

        // Then we have to reorder the new children according to their new order.
        for (let i = 0; i < newConfig.children.length; i++) {
          item.setChildMenuItemIndex(newConfig.children[i].matchingChild, i);
        }
      }

      // Then, all remaining old MenuItems are deleted.
      for (let child of children) {
        item.removeMenuItem(child);

        if (this._menuPath.includes(child)) {
          let removedElement;
          do {
            removedElement = this._menuPath.shift();
          } while (removedElement != child);
        }
      }

      // Continue recursively
      if (newConfig.children) {
        for (let i = 0; i < newConfig.children.length; i++) {
          updateMenuItem(newConfig.children[i], newConfig.children[i].matchingChild);
        }
      }
    };

    // This recursively updates all children based on the settings in structure.
    updateMenuItem(structure, this._root);

    // Re-idealize the trace. This can lead to pretty intense changes, but that's the way
    // it's supposed to be.
    let [x, y] = this._menuPath[0].get_transformed_position();
    this._resetState(x, y);

    return 0;
  }


  // This is called every time a settings key changes. This is simply forwarded to all
  // items which need redrawing. This could definitely be optimized.
  onSettingsChange() {

    // Cache the display delay value.
    this._displayTimeout = this._settings.get_double('display-timeout');

    // Notify the selection wedges on the change.
    this._selectionWedges.onSettingsChange(this._settings);

    // Then call onSettingsChange() for each item of our menu. This ensures that the menu
    // is instantly updated in preview mode.
    if (this._root != undefined) {
      this._root.onSettingsChange(this._settings);
      this._root.redraw();
    }
  }

  // ----------------------------------------------------------------------- private stuff

  // The open() method does not make the menu visible. This is done separately with this
  // method. This allows for the mark-ahead mode in which the user can use the menu
  // blindly.
  _reveal() {
    this._background.reveal();
  }

  // This calls the _reveal() method after this._displayTimeout milliseconds.
  _revealDelayed() {
    if (this._displayTimeout == 0) {
      this._reveal();
    } else {
      this._displayTimeoutID =
          GLib.timeout_add(GLib.PRIORITY_DEFAULT, this._displayTimeout, () => {
            this._reveal();
            this._displayTimeoutID = -1;
          });
    }
  }

  // This is called whenever a menu is opened to position it on the screen. It will not
  // only move the root actor but also the selection wedges.
  _setPosition(x, y, doPointerWarp) {
    const [clampedX, clampedY] =
        this._clampToToMonitor(x - this._background.x, y - this._background.y, 10);
    this._root.set_translation(clampedX, clampedY, 0);
    this._selectionWedges.set_translation(clampedX, clampedY, 0);

    // Warp the mouse pointer if required.
    if (doPointerWarp && (x != clampedX || y != clampedY)) {
      this._input.warpPointer(
          clampedX + this._background.x, clampedY + this._background.y);
    }

    // Report an initial motion event at the menu's center. This ensures that gestures
    // are detected properly even if the initial pointer movement is really fast.
    const mods = global.get_pointer()[2];
    this._selectionWedges.onMotionEvent([clampedX, clampedY], mods);
  }

  // This assigns IDs and angles to each and every item. It also ensures that the root
  // item has a name and an icon set.
  _normalizeMenuStructure(structure) {

    // Make sure that a name and an icon is set.
    if (structure.name == undefined) {
      structure.name = 'root';
    }

    if (structure.icon == undefined) {
      structure.icon = 'image-missing';
    }

    structure.angle = 0;
    structure.id    = '/';

    // Calculate and verify all item angles and assign an ID to each item.
    if (structure.children) {
      if (!this._updateItemAngles(structure.children)) {
        return DBusInterface.errorCodes.eInvalidAngles;
      }

      this._updateItemIDs(structure.children, '');
    }

    return 0;
  }

  // This method recursively traverses the menu structure and assigns an ID to each
  // item. If an item already has an ID property, this is not touched. This ID will be
  // passed to the OnSelect handler. The default IDs are paths like /0/2/1.
  _updateItemIDs(items, parentID) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.id) {
        item.id = parentID + '/' + i;
      }

      // Proceed recursively with the children.
      if (item.children) {
        this._updateItemIDs(item.children, item.id);
      }
    }
  }

  // This method recursively traverses the menu structure and assigns an angle to each
  // item. If an item already has an angle property, this is considered a fixed angle and
  // all others are distributed more ore less evenly around. This method also reserves the
  // required angular space for the back navigation link to the parent item. Angles in
  // items are always in degrees, 0° is on the top, 90° on the right, 180° on the bottom
  // and so on. This method returns true on success, false otherwise.
  _updateItemAngles(items, parentAngle) {

    // First use the utils method to compute all item angles.
    const itemAngles = utils.computeItemAngles(items, parentAngle);

    // Shouldn't happen, but who knows...
    if (itemAngles == null) {
      return false;
    }

    // Now assign the computed angles to our item list.
    itemAngles.forEach((angle, index) => {
      items[index].angle = angle;
    });

    // Now that all angles are set, update the child items.
    items.forEach(item => {
      if (item.children) {
        if (!this._updateItemAngles(item.children, (item.angle + 180) % 360)) {
          return false;
        }
      }
    });

    return true;
  }

  // This assigns MenuItemState.CENTER_HOVERED to the first entry of the menu path and
  // MenuItemState.PARENT to all other menu path entries. All other items get an
  // appropriate state recursively. In addition, the trace between the item is idealized.
  _resetState(tipX, tipY) {
    // This recursively redraws all children based on their newly assigned state.
    this._menuPath[0].setState(MenuItemState.CENTER_HOVERED, -1);
    for (let i = 1; i < this._menuPath.length; i++) {
      let activeChildIndex = 0;
      const siblings       = this._menuPath[i].getChildMenuItems();
      for (let j = 0; j < siblings.length; j++) {
        if (this._menuPath[i - 1] == siblings[j]) {
          activeChildIndex = j;
          break;
        }
      }
      this._menuPath[i].setState(MenuItemState.PARENT, activeChildIndex);
    }

    // Re-idealize the trace. This can lead to pretty intense changes, but that's the way
    // it's supposed to be.
    this._idealizeTace(tipX, tipY);

    // Recursively redraw everything.
    this._root.redraw();

    // Set the wedge angles of the SelectionWedges according to the new item structure.
    const itemAngles = [];
    this._menuPath[0].getChildMenuItems().forEach(item => {
      itemAngles.push(item.angle);
    });

    if (this._menuPath.length > 1) {
      this._selectionWedges.setItemAngles(
          itemAngles, (this._menuPath[0].angle + 180) % 360);
    } else {
      this._selectionWedges.setItemAngles(itemAngles);
    }

    this._selectionWedges.set_translation(
        tipX - this._background.x, tipY - this._background.y, 0);
  }

  // x and y are the center coordinates of a MenuItem. This method returns a new position
  // [x, y] which ensures that the MenuItem and all of its children and grandchildren are
  // inside the current monitor's bounds, including the specified margin. This is done by
  // calculating the theoretically largest extends based on the current appearance
  // settings.
  _clampToToMonitor(x, y, margin) {

    const wedgeRadius  = this._settings.get_double('wedge-inner-radius');
    const centerRadius = Math.max(
        this._settings.get_double('center-size') / 2,
        this._settings.get_double('center-size-hover') / 2);
    const childRadius = Math.max(
        this._settings.get_double('child-size') / 2 +
            this._settings.get_double('child-offset'),
        this._settings.get_double('child-size-hover') / 2 +
            this._settings.get_double('child-offset-hover'));
    const grandchildRadius = Math.max(
        this._settings.get_double('child-offset') +
            this._settings.get_double('grandchild-size') / 2 +
            this._settings.get_double('grandchild-offset'),
        this._settings.get_double('child-offset-hover') +
            this._settings.get_double('grandchild-size-hover') / 2 +
            this._settings.get_double('grandchild-offset-hover'));

    // Calculate theoretically largest extent.
    let maxSize = wedgeRadius;
    maxSize     = Math.max(maxSize, centerRadius);
    maxSize     = Math.max(maxSize, childRadius);
    maxSize     = Math.max(maxSize, grandchildRadius);
    maxSize *= 2 * this._settings.get_double('global-scale');

    // Clamp to monitor bounds.
    const monitor = Main.layoutManager.currentMonitor;

    const min  = margin + maxSize / 2;
    const maxX = monitor.width - min;
    const maxY = monitor.height - min;

    const posX = Math.min(Math.max(x, min), maxX);
    const posY = Math.min(Math.max(y, min), maxY);

    // Ensure integer position.
    return [Math.floor(posX), Math.floor(posY)];
  }

  // This returns true if the distance between the to positions a and b is less than the
  // dnd_drag_threshold given by Clutter.
  _isInDragThreshold(a, b) {
    const diff = [a[0] - b[0], a[1] - b[1]];
    const dist = Math.sqrt(diff[0] * diff[0] + diff[1] * diff[1]);

    return dist < Clutter.Settings.get_default().dnd_drag_threshold;
  }

  // The "trace" of the menu needs to be "idealized". That means, even if the user did
  // not click exactly in the direction of the item, the line connecting parent and child
  // has to be drawn with the correct angle. As the newly active item will be shown
  // directly at the pointer position, we must move the parent so that the trace has the
  // correct angle. Actually not the parent item has to move but the root of the entire
  // menu selection chain.
  // The root item will be moved so that the currently active item is moved to the
  // absolute position given by tipX and tipY.
  _idealizeTace(tipX, tipY) {

    // This will contain the vector from the menu selection chain's root element to it's
    // tip (the currently selected item). This will be used to move the root element so
    // that the tip of the chain is at the tip position.
    let accumulatedX = 0;
    let accumulatedY = 0;

    // Traverse the chain back-to-front (that is from root-to-tip). We start one element
    // after the root, as the root has not to be positioned relative to any other element.
    for (let i = this._menuPath.length - 2; i >= 0; i--) {
      const item = this._menuPath[i];

      // The item's position relative to its parent.
      let x = item.translation_x;
      let y = item.translation_y;

      // There might be a transition in progress, so we rather grab their final values.
      const tx = item.get_transition('translation-x');
      const ty = item.get_transition('translation-y');
      if (tx) x = tx.interval.final;
      if (ty) y = ty.interval.final;

      // The distance from the parent is considered to be the current length of the trace
      // segment.
      const currentTraceLength = Math.sqrt(x * x + y * y);

      // There is a setting for a minimum trace length.
      const idealTraceLength = Math.max(
          this._settings.get_double('trace-min-length') *
              this._settings.get_double('global-scale'),
          currentTraceLength);

      // Based on this trace length, we can compute where the item should be placed
      // relative to its parent.
      const itemAngle = item.angle * Math.PI / 180;
      const idealX    = Math.floor(Math.sin(itemAngle) * idealTraceLength);
      const idealY    = -Math.floor(Math.cos(itemAngle) * idealTraceLength);

      // Place the item at its idealized position.
      item.set_easing_duration(this._settings.get_double('easing-duration') * 1000);
      item.set_easing_mode(this._settings.get_enum('easing-mode'));
      item.set_translation(idealX, idealY, 0);

      // Accumulate the full trace.
      accumulatedX += idealX;
      accumulatedY += idealY;
    }

    // Transform the desired tip coordinates to root-item space.
    const root                             = this._menuPath[this._menuPath.length - 1];
    const [ok, relativeTipX, relativeTipY] = root.transform_stage_point(tipX, tipY);

    // The root element needs to move by the distance between the accumulated ideal
    // position and the desired tip position.
    const requiredOffsetX = relativeTipX - accumulatedX;
    const requiredOffsetY = relativeTipY - accumulatedY;

    // Finally move the root item so that the tip of the selection chain is beneath the
    // mouse pointer.
    root.set_translation(
        root.translation_x + requiredOffsetX, root.translation_y + requiredOffsetY, 0);
  }

  // Reports an unhover event on the D-Bus for the child of the currently selected menu.
  _unhoverChild(childIndex) {
    if (childIndex >= 0) {
      const child = this._menuPath[0].getChildMenuItems()[childIndex];

      // If the item has a selection callback, it is an action.
      if (child.getSelectionCallback() != null) {

        // If the action has a unhover callback, call it!
        if (child.getUnhoverCallback() != null) {
          child.getUnhoverCallback()();
        }

        // Then emit the D-Bus unhover signal!
        this._emitUnhoverSignal(this._menuID, child.id);
      }
    }
  }

  // Activates the given menu item by emitting all required signals and hides the menu.
  _selectChild(child) {
    if (child.getSelectionCallback() != null) {

      // This is required for the statistics.
      const selectionTime  = this._timer.getElapsed();
      const selectionDepth = this._menuPath.length - 1;
      this._background.set_easing_delay(
          this._settings.get_double('easing-duration') * 1000);

      // close() will reset our menu ID. However, we need to pass it to the onSelect
      // callback so we create a copy here. close() has to be called before
      // _emitSelectSignal(), else any resulting action (like simulated key presses) may
      // be blocked by our input grab.
      const menuID = this._menuID;
      this.close();
      this._background.set_easing_delay(0);

      // If the action has an unhover callback, we call it before. This is to ensure
      // that there are always pairs of hover / unhover events.
      if (child.getUnhoverCallback() != null) {
        child.getUnhoverCallback()();
      }

      // Then emit the D-Bus unhover signal!
      this._emitUnhoverSignal(this._menuID, child.id);

      // Then call the activation callback! Oftentimes, this will open a new window. We
      // make sure that this window is opened at the current pointer location!
      this._openNextWindowAtPointer();
      child.getSelectionCallback()();

      // Report the selection over the D-Bus.
      this._emitSelectSignal(menuID, child.id);

      // Finally, record this selection in the statistics. Parameters are selection depth,
      // time and whether a continuous gesture was used for the selection.
      Statistics.getInstance().addSelection(
          selectionDepth, selectionTime, this._gestureOnlySelection);
    }
  }

  // When executed, this function will move the first window created within the next two
  // seconds to the current location of the mouse pointer. This is always called when an
  // action is executed as many of them will potentially open windows.
  _openNextWindowAtPointer() {

    // First cancel any ongoing window-movement timeouts.
    this._cancelMoveWindowToPointer();

    // Store pointer location. If a new window is opened, it will be centered at this
    // position.
    const [pointerX, pointerY] = global.get_pointer();

    // Wait until the next window is created.
    this._windowCreatedID = global.display.connect('window-created', () => {
      this._windowfocusedID = global.display.connect('notify::focus-window', () => {
        const frame = global.display.focus_window.get_frame_rect();
        const area  = global.display.focus_window.get_work_area_current_monitor();

        // Center on the pointer.
        frame.x = pointerX - frame.width / 2;
        frame.y = pointerY - frame.height / 2;

        // Clamp to the work area.
        frame.x = Math.min(Math.max(frame.x, area.x), area.x + area.width - frame.width);
        frame.y =
            Math.min(Math.max(frame.y, area.y), area.y + area.height - frame.height);

        // Move the window!
        global.display.focus_window.move_frame(true, frame.x, frame.y);

        // Disconnect, we will only move the window once.
        global.display.disconnect(this._windowfocusedID);
        this._windowfocusedID = null;
      });

      // Disconnect, we will only move the first window created within the timeout period.
      global.display.disconnect(this._windowCreatedID);
      this._windowCreatedID = null;
    });

    // Disconnect the handlers after two seconds (if they were not called).
    this._cancelMoveWindowID = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
      this._cancelMoveWindowID = null;
      this._cancelMoveWindowToPointer();
      return false;
    });
  }

  // This cancels any pending move-window-pointer operation started with the method above.
  _cancelMoveWindowToPointer() {
    if (this._windowCreatedID) {
      global.display.disconnect(this._windowCreatedID);
      this._windowCreatedID = null;
    }

    if (this._windowfocusedID) {
      global.display.disconnect(this._windowfocusedID);
      this._windowfocusedID = null;
    }

    if (this._cancelMoveWindowID) {
      GLib.source_remove(this._cancelMoveWindowID);
      this._cancelMoveWindowID = null;
    }
  }
};
