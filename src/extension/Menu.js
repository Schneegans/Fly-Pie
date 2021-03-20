//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Main                = imports.ui.main;
const {Clutter, Gdk, Gtk} = imports.gi;

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

  // The Menu is only instantiated once by the Server. It is re-used for each new incoming
  // ShowMenu request. The three parameters are callbacks which are fired when the
  // corresponding event occurs.
  constructor(emitHoverSignal, emitUnhoverSignal, emitSelectSignal, emitCancelSignal) {

    // Create Gio.Settings object for org.gnome.shell.extensions.flypie.
    this._settings = utils.createSettings();

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

    // Stores a reference to the MenuItem which is currently dragged around while a
    // gesture is performed.
    this._draggedChild = null;

    // This is a list of active MenuItems. At the beginning it will contain the root
    // MenuItem only. Selected children deeper in the hierarchy are prepended to this
    // list. This means, the currently active menu node is always _menuSelectionChain[0].
    this._menuSelectionChain = [];

    // This is used to warp the mouse pointer at the edges of the screen if necessary.
    this._input = new InputManipulator();

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

    // Hide the menu when the escape key is pressed.
    this._background.connect('key-press-event', (actor, event) => {
      if (event.get_key_symbol() == Clutter.KEY_Escape && this._menuID != null) {
        this.cancel();
        this.hide();
      }
      return Clutter.EVENT_STOP;
    });

    // When a button is released while an item is dragged around, this can lead to a
    // selection in "Turbo Mode".
    this._background.connect('key-release-event', (actor, event) => {
      if (this._draggedChild != null) {
        // This will potentially fire the OnSelect signal.
        this._selectionWedges.onKeyReleaseEvent();
      }
      return Clutter.EVENT_STOP;
    });

    // Forward button release events to the SelectionWedges.
    this._background.connect('button-release-event', (actor, event) => {
      // This will potentially fire the OnSelect signal.
      this._selectionWedges.onButtonReleaseEvent(event);
      // This is for the statistics only: As the mouse button was released, this is not
      // going to be a gesture-only selection.
      this._gestureOnlySelection = false;
      return Clutter.EVENT_STOP;
    });

    // Forward motion events to the SelectionWedges. If the primary mouse button is
    // pressed, this will also drag the currently active child around.
    this._background.connect('motion-event', (actor, event) => {
      this._selectionWedges.onMotionEvent(event);

      // If the primary button is pressed or a modifier is held down (for the
      // "Turbo-Mode"), but we do not have a dragged child yet, we mark the currently
      // hovered child as being the dragged child.
      if ((this._selectionWedges.isGestureModifier(event.get_state())) &&
          this._draggedChild == null) {
        const index = this._selectionWedges.getHoveredChild();
        if (index >= 0) {
          const child = this._menuSelectionChain[0].getChildMenuItems()[index];
          child.setState(MenuItemState.CHILD_DRAGGED);
          this._draggedChild = child;
        }
      }

      // If there is a dragged child, update its position.
      if (this._draggedChild != null) {

        // This is for the statistics only: If this is the first gesture during the
        // current selection, we set this member to true. It will be set to false as soon
        // as the mouse button is released again.
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

        // This shouldn't be necessary but it reduces some severe flickering when children
        // are dragged around slowly. It almost seems as some buffers are not cleared
        // sufficiently without this...
        this._background.queue_redraw();
      }

      return Clutter.EVENT_STOP;
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
      this.hide();
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
      const unhoveredIndex = this._menuSelectionChain[0].getActiveChildIndex();

      // If no child is hovered (hoveredIndex == -1), the center element is hovered.
      if (hoveredIndex == -1) {
        this._menuSelectionChain[0].setState(MenuItemState.CENTER_HOVERED, -1);
      } else {
        this._menuSelectionChain[0].setState(MenuItemState.CENTER, hoveredIndex);
      }

      // It could be that the parent of the currently active item was hovered before, so
      // lets set its state back to PARENT.
      if (this._menuSelectionChain.length > 1) {
        this._menuSelectionChain[1].setState(MenuItemState.PARENT);
      }

      // If we're currently dragging a child around, the newly hovered child will
      // instantaneously become the hovered child.
      const [x, y, mods] = global.get_pointer();
      if (this._selectionWedges.isGestureModifier(mods) && hoveredIndex >= 0) {
        const child = this._menuSelectionChain[0].getChildMenuItems()[hoveredIndex];
        child.setState(MenuItemState.CHILD_DRAGGED);
        this._draggedChild = child;
      } else {
        this._draggedChild = null;
      }

      // Report the unhover event on the D-Bus if an action was hovered before.
      if (unhoveredIndex >= 0) {
        const child = this._menuSelectionChain[0].getChildMenuItems()[unhoveredIndex];

        // If the item has a selection callback, it is an action.
        if (child.getSelectionCallback() != null) {

          // If the action has a hover callback, call it!
          if (child.getUnhoverCallback() != null) {
            child.getUnhoverCallback()();
          }

          // Then emit the D-Bus unhover signal!
          this._emitUnhoverSignal(this._menuID, child.id);
        }
      }

      // Report the hover event on the D-Bus if an action is hovered.
      if (hoveredIndex >= 0) {
        const child = this._menuSelectionChain[0].getChildMenuItems()[hoveredIndex];

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
    this._selectionWedges.connect('child-selected-event', (o, index) => {
      const parent = this._menuSelectionChain[0];
      const child  = this._menuSelectionChain[0].getChildMenuItems()[index];

      const [pointerX, pointerY, mods] = global.get_pointer();

      // Ignore any gesture-based selection of leaf nodes. Final selections are only done
      // when the mouse button or a modifier button is released. An exception is the
      // experimental hover mode in which we also allow selections by gestures.
      const hoverMode = this._settings.get_boolean('hover-mode');
      if (!hoverMode && this._selectionWedges.isGestureModifier(mods) &&
          child.getChildMenuItems().length == 0) {
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
      this._menuSelectionChain.unshift(child);

      // The newly active item will be shown at the pointer position. To prevent it from
      // going offscreen, we clamp the position to the current monitor bounds (we do it
      // removing background boundaries from mouse pointer).
      const [clampedX, clampedY] = this._clampToToMonitor(
          pointerX - this._background.x, pointerY - this._background.y, 10);

      // Warp the mouse pointer to this position if necessary accounting background
      // position as well.
      if (pointerX != clampedX || pointerY != clampedY) {
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
      if (child.getSelectionCallback() != null) {

        // Record this selection in the statistics. Parameters are selection depth, time
        // and whether a continuous gesture was used for the selection.
        Statistics.addSelection(
            this._menuSelectionChain.length - 1, this._timer.getElapsed(),
            this._gestureOnlySelection);

        this._background.set_easing_delay(
            this._settings.get_double('easing-duration') * 1000);

        // hide() will reset our menu ID. However, we need to pass it to the onSelect
        // callback so we create a copy here. hide() has to be called before
        // _emitSelectSignal(), else any resulting action (like simulated key presses) may
        // be blocked by our input grab.
        const menuID = this._menuID;
        this.hide();
        this._background.set_easing_delay(0);

        // If the action has an unhover callback, we call it before. This is to ensure
        // that there are always pairs of hover / unhover events.
        if (child.getUnhoverCallback() != null) {
          child.getUnhoverCallback()();
        }

        // Then emit the D-Bus unhover signal!
        this._emitUnhoverSignal(this._menuID, child.id);

        // Then call the activation callback!
        child.getSelectionCallback()();

        // Finally report the selection over the D-Bus.
        this._emitSelectSignal(menuID, child.id);
      }
    });

    // When a parent item is hovered, we draw the currently active item with the state
    // CENTER_HOVERED to indicate that the parent is not a child.
    this._selectionWedges.connect('parent-hovered-event', () => {
      // If there is a currently hovered child, we may have to call the unhover signal.
      const unhoveredIndex = this._menuSelectionChain[0].getActiveChildIndex();

      // Report the unhover event on the D-Bus if an action was hovered before.
      if (unhoveredIndex >= 0) {
        const child = this._menuSelectionChain[0].getChildMenuItems()[unhoveredIndex];

        // If the item has a selection callback, it is an action.
        if (child.getSelectionCallback() != null) {

          // If the action has a hover callback, call it!
          if (child.getUnhoverCallback() != null) {
            child.getUnhoverCallback()();
          }

          // Then emit the D-Bus unhover signal!
          this._emitUnhoverSignal(this._menuID, child.id);
        }
      }

      this._menuSelectionChain[0].setState(MenuItemState.CENTER_HOVERED, -1);
      this._menuSelectionChain[1].setState(MenuItemState.PARENT_HOVERED);

      // This recursively redraws all children based on their newly assigned state.
      this._root.redraw();

      // Parent items cannot be dragged around. Even if the mouse button is still pressed
      // (we might come here when a gesture was detected by the SelectionWedges), we abort
      // any dragging operation.
      this._draggedChild = null;
    });

    // If the parent of the currently active item is selected, it becomes the newly active
    // item with the state CENTER_HOVERED.
    this._selectionWedges.connect('parent-selected-event', () => {
      const parent = this._menuSelectionChain[1];
      parent.setState(MenuItemState.CENTER_HOVERED, -1);

      // Remove the first element of the menu selection chain.
      this._menuSelectionChain.shift();

      // The parent item will be moved to the pointer position. To prevent it from
      // going offscreen, we clamp the position to the current monitor bounds (we do it
      // removing background boundaries from mouse pointer).
      const [pointerX, pointerY] = global.get_pointer();
      const [clampedX, clampedY] = this._clampToToMonitor(
          pointerX - this._background.x, pointerY - this._background.y, 10);

      // Warp the mouse pointer to this position if necessary accounting background
      // position as well.
      if (pointerX != clampedX || pointerY != clampedY) {
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
      if (this._menuSelectionChain.length > 1) {
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
      this.hide();
    });

    // Whenever settings are changed, we adapt the currently shown menu accordingly.
    this._settingsConnection =
        this._settings.connect('change-event', this._onSettingsChange.bind(this));
    this._onSettingsChange();
  }

  // This removes our root actor from GNOME Shell.
  destroy() {
    Main.layoutManager.removeChrome(this._background);
    this._background.destroy();
    this._settings.disconnect(this._settingsConnection);
  }

  // -------------------------------------------------------------------- public interface

  // Returns the ID of the currently visible menu. Will be null if no menu is currently
  // shown.
  getID() {
    return this._menuID;
  }

  // This shows the menu, or updates the menu if it is already visible. Returns an error
  // code if something went wrong. See DBusInerface.js for all possible error codes.
  show(menuID, structure, previewMode) {

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
      this._background.show(previewMode);

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
    this._background.show(previewMode);

    // Everything seems alright, start opening the menu!
    this._menuID = menuID;

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

    this._menuSelectionChain.push(this._root);

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
      const [pointerX, pointerY] = global.get_pointer();
      const [clampedX, clampedY] = this._clampToToMonitor(
          pointerX - this._background.x, pointerY - this._background.y, 10);
      this._root.set_translation(clampedX, clampedY, 0);
      this._selectionWedges.set_translation(clampedX, clampedY, 0);

      if (pointerX != clampedX || pointerY != clampedY) {
        this._input.warpPointer(
            clampedX + this._background.x, clampedY + this._background.y);
      }
    }

    return this._menuID;
  }

  // Hides the menu and the background actor.
  hide() {

    // The menu is not active; nothing to be done.
    if (this._menuID == null) {
      return;
    }

    // Fade out the background actor. Once this transition is completed, the _root item
    // will be destroyed by the background's "transitions-completed" signal handler.
    this._background.hide();

    // Rest menu ID. With this set to null, we can accept new menu requests.
    this._menuID = null;

    // Reset some other members.
    this._draggedChild       = null;
    this._menuSelectionChain = [];
  }

  // Emits the DBus-Cancel signal and potentially an unhover signal for the currently
  // hovered item (if any).
  cancel() {
    const index = this._selectionWedges.getHoveredChild();
    if (index >= 0) {
      const child = this._menuSelectionChain[0].getChildMenuItems()[index];

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

        if (this._menuSelectionChain.includes(child)) {
          let removedElement;
          do {
            removedElement = this._menuSelectionChain.shift();
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

    // This recursively redraws all children based on their newly assigned state.
    this._menuSelectionChain[0].setState(MenuItemState.CENTER_HOVERED, -1);
    for (let i = 1; i < this._menuSelectionChain.length; i++) {
      let activeChildIndex = 0;
      const siblings       = this._menuSelectionChain[i].getChildMenuItems();
      for (let j = 0; j < siblings.length; j++) {
        if (this._menuSelectionChain[i - 1] == siblings[j]) {
          activeChildIndex = j;
          break;
        }
      }
      this._menuSelectionChain[i].setState(MenuItemState.PARENT, activeChildIndex);
    }

    // Re-idealize the trace. This can lead to pretty intense changes, but that's the way
    // it's supposed to be.
    let [x, y] = this._menuSelectionChain[0].get_transformed_position();
    this._idealizeTace(x, y);

    // Recursively redraw everything.
    this._root.redraw();

    // Set the wedge angles of the SelectionWedges according to the new item structure.
    const itemAngles = [];
    this._menuSelectionChain[0].getChildMenuItems().forEach(item => {
      itemAngles.push(item.angle);
    });

    if (this._menuSelectionChain.length > 1) {
      this._selectionWedges.setItemAngles(
          itemAngles, (this._menuSelectionChain[0].angle + 180) % 360);
    } else {
      this._selectionWedges.setItemAngles(itemAngles);
    }

    this._selectionWedges.set_translation(
        x - this._background.x, y - this._background.y, 0);

    return 0;
  }

  // ----------------------------------------------------------------------- private stuff

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

    // Shouldn't happen, but who knows...
    if (items.length == 0) {
      return true;
    }

    // First we calculate all angles for the current menu level. We begin by storing all
    // fixed angles.
    const fixedAngles = [];
    items.forEach((item, index) => {
      if ('angle' in item && item.angle >= 0) {
        fixedAngles.push({angle: item.angle, index: index});
      }
    });

    // Make sure that the parent link does not collide with a fixed item. For now, we
    // just move the fixed angle a tiny bit. This is somewhat error-prone as it may
    // collide with another fixed angle now. Maybe this could be solved in a better way?
    // Maybe some global minimum angular spacing of items?
    if (parentAngle != undefined) {
      for (let i = 0; i < fixedAngles.length; i++) {
        if (Math.abs(fixedAngles[i].angle - parentAngle) < 0.0001) {
          fixedAngles[i].angle += 0.1;
        }
      }
    }

    // Make sure that the fixed angles increase monotonically and are between 0° and 360°.
    for (let i = 0; i < fixedAngles.length; i++) {
      if (i > 0 && fixedAngles[i].angle <= fixedAngles[i - 1].angle) {
        return false;
      }

      if (fixedAngles[i].angle < 0.0 || fixedAngles[i].angle >= 360.0) {
        return false;
      }
    }

    // If no item has a fixed angle, we assign one to the first item. If there is no
    // parent item, this is on the top (0°). Else, the angular space will be evenly
    // distributed to all child items and the first item will be the one closest to the
    // top.
    if (fixedAngles.length == 0) {
      let firstAngle = 0;
      if (parentAngle != undefined) {
        const wedgeSize  = 360 / (items.length + 1);
        let minAngleDiff = 360;
        for (let i = 0; i < items.length; i++) {
          const angle     = (parentAngle + (i + 1) * wedgeSize) % 360;
          const angleDiff = Math.min(angle, 360 - angle);

          if (angleDiff < minAngleDiff) {
            minAngleDiff = angleDiff;
            firstAngle   = (angle + 360) % 360;
          }
        }
      }
      fixedAngles.push({angle: firstAngle, index: 0});
      items[0].angle = firstAngle;
    }

    // Now we iterate through the fixed angles, always considering wedges between
    // consecutive pairs of fixed angles. If there is only one fixed angle, there is also
    // only one 360°-wedge.
    for (let i = 0; i < fixedAngles.length; i++) {
      let wedgeBeginIndex = fixedAngles[i].index;
      let wedgeBeginAngle = fixedAngles[i].angle;
      let wedgeEndIndex   = fixedAngles[(i + 1) % fixedAngles.length].index;
      let wedgeEndAngle   = fixedAngles[(i + 1) % fixedAngles.length].angle;

      // Make sure we loop around.
      if (wedgeEndAngle <= wedgeBeginAngle) {
        wedgeEndAngle += 360;
      }

      // Calculate the number of items between the begin and end indices.
      let wedgeItemCount =
          (wedgeEndIndex - wedgeBeginIndex - 1 + items.length) % items.length;

      // We have one item more if the parent link is inside our wedge.
      let parentInWedge = false;

      if (parentAngle != undefined) {
        // It can be that the parent link is inside the current wedge, but it's angle if
        // one full turn off.
        if (parentAngle < wedgeBeginAngle) {
          parentAngle += 360;
        }

        parentInWedge = parentAngle > wedgeBeginAngle && parentAngle < wedgeEndAngle;
        if (parentInWedge) {
          wedgeItemCount += 1;
        }
      }

      // Calculate the angular difference between consecutive items in the current wedge.
      const wedgeItemGap = (wedgeEndAngle - wedgeBeginAngle) / (wedgeItemCount + 1);

      // Now we assign an angle to each item between the begin and end indices.
      let index             = (wedgeBeginIndex + 1) % items.length;
      let count             = 1;
      let parentGapRequired = parentInWedge;

      while (index != wedgeEndIndex) {
        let itemAngle = wedgeBeginAngle + wedgeItemGap * count;

        // Insert gap for parent link if required.
        if (parentGapRequired && itemAngle + wedgeItemGap / 2 - parentAngle > 0) {
          count += 1;
          itemAngle         = wedgeBeginAngle + wedgeItemGap * count;
          parentGapRequired = false;
        }

        items[index].angle = itemAngle % 360;

        index = (index + 1) % items.length;
        count += 1;
      }
    }

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

  // This is called every time a settings key changes. This is simply forwarded to all
  // items which need redrawing. This could definitely be optimized.
  _onSettingsChange() {

    // Notify the selection wedges on the change.
    this._selectionWedges.onSettingsChange(this._settings);

    // Then call onSettingsChange() for each item of our menu. This ensures that the menu
    // is instantly updated in preview mode.
    if (this._root != undefined) {
      this._root.onSettingsChange(this._settings);
      this._root.redraw();
    }
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
    for (let i = this._menuSelectionChain.length - 2; i >= 0; i--) {
      const item = this._menuSelectionChain[i];

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
    const root = this._menuSelectionChain[this._menuSelectionChain.length - 1];
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
};
