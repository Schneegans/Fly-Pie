//////////////////////////////////////////////////////////////////////////////////////////
//   _____       _             _____ _                                                  //
//  |   __|_ _ _|_|___ ___ ___|  _  |_|___   This software may be modified and distri-  //
//  |__   | | | | |   | . |___|   __| | -_|  buted under the terms of the MIT license.  //
//  |_____|_____|_|_|_|_  |   |__|  |_|___|  See the LICENSE file for details.          //
//                    |___|                                                             //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Main                = imports.ui.main;
const Cairo               = imports.cairo;
const {Clutter, Gio, Gdk} = imports.gi;

const Me               = imports.misc.extensionUtils.getCurrentExtension();
const utils            = Me.imports.common.utils;
const DBusInterface    = Me.imports.common.DBusInterface.DBusInterface;
const InputManipulator = Me.imports.common.InputManipulator.InputManipulator;
const Background       = Me.imports.server.Background.Background;
const MenuItem         = Me.imports.server.MenuItem.MenuItem;
const SelectionWedges  = Me.imports.server.SelectionWedges.SelectionWedges;
const MenuItemState    = Me.imports.server.MenuItem.MenuItemState;

var Menu = class Menu {

  // ------------------------------------------------------------ constructor / destructor

  constructor(onHover, onSelect, onCancel) {

    this._settings = utils.createSettings();

    this._onHover      = onHover;
    this._onSelect     = onSelect;
    this._onCancel     = onCancel;
    this._menuID       = null;
    this._editMode     = false;
    this._draggedChild = null;

    this._menuSelectionChain = [];

    this._input = new InputManipulator();

    this._background = new Background();
    Main.layoutManager.addChrome(this._background);

    this._background.connect('transitions-completed', () => {
      if (this._background.opacity == 0 && this._root) {
        this._root.destroy();
        this._root = null;
      }
    });

    this._background.connect('button-release-event', (actor, event) => {
      this._selectionWedges.onButtonReleaseEvent(event);
      return Clutter.EVENT_STOP;
    });

    this._background.connect('close-event', () => {
      this._onCancel(this._menuID);
      this._hide();
    });

    this._background.connect('motion-event', (actor, event) => {
      this._selectionWedges.onMotionEvent(event);

      if (event.get_state() & Clutter.ModifierType.BUTTON1_MASK &&
          this._draggedChild == null) {
        const index = this._selectionWedges.getHoveredChild();
        if (index >= 0) {
          const child = this._menuSelectionChain[0].getChildMenuItems()[index];
          child.setState(MenuItemState.CHILD_DRAGGED);
          this._draggedChild = child;
        }
      }


      if (this._draggedChild != null) {

        const parent = this._draggedChild.get_parent().get_parent();

        let [x, y] = event.get_coords();
        let ok;
        [ok, x, y] = parent.transform_stage_point(x, y);

        this._draggedChild.set_easing_duration(0);
        this._draggedChild.set_translation(x, y, 0);

        parent.drawTrace(x, y, 0, 0);
        this._background.queue_redraw();
      }

      return Clutter.EVENT_STOP;
    });

    this._selectionWedges = new SelectionWedges();
    this._background.add_child(this._selectionWedges);

    this._selectionWedges.connect('child-hovered-event', (o, index) => {
      if (index == -1) {
        this._menuSelectionChain[0].setState(MenuItemState.CENTER_HOVERED, -1);
      } else {
        this._menuSelectionChain[0].setState(MenuItemState.CENTER, index);
      }

      if (this._menuSelectionChain.length > 1) {
        this._menuSelectionChain[1].setState(MenuItemState.PARENT);
      }

      const [x, y, mods] = global.get_pointer();
      if (mods & Clutter.ModifierType.BUTTON1_MASK && index >= 0) {
        const child = this._menuSelectionChain[0].getChildMenuItems()[index];
        child.setState(MenuItemState.CHILD_DRAGGED);
        this._draggedChild = child;
      } else {
        this._draggedChild = null;
      }

      this._root.redraw();
    });

    this._selectionWedges.connect('child-selected-event', (o, index) => {
      const parent = this._menuSelectionChain[0];
      const child  = this._menuSelectionChain[0].getChildMenuItems()[index];

      const [pointerX, pointerY, mods] = global.get_pointer();
      if (mods & Clutter.ModifierType.BUTTON1_MASK &&
          child.getChildMenuItems().length == 0) {
        return;
      }

      parent.setState(MenuItemState.PARENT, index);
      child.setState(MenuItemState.CENTER_HOVERED);
      this._menuSelectionChain.unshift(child);

      const [clampedX, clampedY] = this._clampToToMonitor(pointerX, pointerY, 10);

      if (pointerX != clampedX || pointerY != clampedY) {
        this._input.warpPointer(clampedX, clampedY);
      }

      if (child.getChildMenuItems().length > 0) {
        const itemAngles = [];
        child.getChildMenuItems().forEach(item => {
          itemAngles.push(item.angle);
        });
        this._selectionWedges.setItemAngles(itemAngles, (child.angle + 180) % 360);

        this._selectionWedges.set_translation(
            clampedX - this._background.x, clampedY - this._background.y, 0);
      }

      const [ok, relativeX, relativeY] = parent.transform_stage_point(clampedX, clampedY);

      const currentTraceLength = Math.sqrt(relativeX * relativeX + relativeY * relativeY);
      const idealTraceLength   = Math.max(
          this._settings.get_double('trace-min-length') *
              this._settings.get_double('global-scale'),
          currentTraceLength);

      const childAngle = child.angle * Math.PI / 180;
      const idealX     = Math.floor(Math.sin(childAngle) * idealTraceLength);
      const idealY     = -Math.floor(Math.cos(childAngle) * idealTraceLength);

      const requiredOffsetX = relativeX - idealX;
      const requiredOffsetY = relativeY - idealY;

      const root = this._menuSelectionChain[this._menuSelectionChain.length - 1];

      root.set_translation(
          root.translation_x + requiredOffsetX, root.translation_y + requiredOffsetY, 0);

      child.set_easing_duration(this._settings.get_double('easing-duration') * 1000);
      child.set_easing_mode(this._settings.get_enum('easing-mode'));
      child.set_translation(idealX, idealY, 0);

      this._draggedChild = null;

      this._root.redraw();

      if (child.getChildMenuItems().length == 0) {
        this._onSelect(this._menuID, child.id);
        this._background.set_easing_delay(
            this._settings.get_double('easing-duration') * 1000);
        this._hide();
        this._background.set_easing_delay(0);
      }
    });

    this._selectionWedges.connect('parent-hovered-event', () => {
      this._menuSelectionChain[0].setState(MenuItemState.CENTER_HOVERED, -1);
      this._menuSelectionChain[1].setState(MenuItemState.PARENT_HOVERED);
      this._root.redraw();
      this._draggedChild = null;
    });

    this._selectionWedges.connect('parent-selected-event', () => {
      const parent = this._menuSelectionChain[1];
      parent.setState(MenuItemState.CENTER_HOVERED, -1);

      this._menuSelectionChain.shift();

      const [pointerX, pointerY] = global.get_pointer();
      const [clampedX, clampedY] = this._clampToToMonitor(pointerX, pointerY, 10);

      if (pointerX != clampedX || pointerY != clampedY) {
        this._input.warpPointer(clampedX, clampedY);
      }

      const itemAngles = [];
      parent.getChildMenuItems().forEach(item => {
        itemAngles.push(item.angle);
      });

      if (this._menuSelectionChain.length > 1) {
        this._selectionWedges.setItemAngles(itemAngles, (parent.angle + 180) % 360);
      } else {
        this._selectionWedges.setItemAngles(itemAngles);
      }

      this._selectionWedges.set_translation(
          clampedX - this._background.x, clampedY - this._background.y, 0);


      if (this._menuSelectionChain.length > 1) {
        const [ok, relativeX, relativeY] =
            parent.transform_stage_point(clampedX, clampedY);

        const root = this._menuSelectionChain[this._menuSelectionChain.length - 1];
        root.translation_x = root.translation_x + relativeX;
        root.translation_y = root.translation_y + relativeY;

      } else {
        const [ok, relativeX, relativeY] =
            this._background.transform_stage_point(clampedX, clampedY);
        parent.set_translation(relativeX, relativeY, 0);
      }

      this._draggedChild = null;

      this._root.redraw();
    });


    this._selectionWedges.connect('cancel-selection-event', () => {
      this._onCancel(this._menuID);
      this._hide();
    });


    // For some reason this has to be set explicitly to true before it can be set to
    // false.
    global.stage.cursor_visible = true;

    this._settings.connect('change-event', this._onSettingsChange.bind(this));
    this._onSettingsChange();
  }

  destroy() {
    Main.layoutManager.removeChrome(this._background);
    this._background.destroy();
  }

  // -------------------------------------------------------------------- public interface

  // This shows the menu, blocking all user input. A subtle animation is used to fade in
  // the menu. Returns an error code if something went wrong.
  show(menuID, structure, editMode) {

    // The menu is already active.
    if (this._menuID) {
      return DBusInterface.errorCodes.eAlreadyActive;
    }

    // Check if there is a root item list.
    if (!(structure.items && structure.items.length > 0)) {
      return DBusInterface.errorCodes.ePropertyMissing;
    }

    // Remove any previous menus.
    if (this._root) {
      this._root.destroy();
    }

    // Store the edit mode flag.
    this._editMode = editMode;

    // To avoid frequent checks for the existence of the items list member, we add an
    // empty list for items without children.
    this._createEmptyChildrenLists(structure);

    // Calculate and verify all item angles.
    structure.angle = 0;
    if (!this._updateItemAngles(structure.items)) {
      return DBusInterface.errorCodes.eInvalidAngles;
    }

    // Assign an ID to each item.
    structure.id = '/';
    this._updateItemIDs(structure.items);

    // Try to grab the complete input.
    if (!this._background.show(editMode)) {
      // Something went wrong while grabbing the input. Let's abort this.
      return DBusInterface.errorCodes.eUnknownError;
    }

    // Everything seems alright, start opening the menu!
    this._menuID = menuID;

    // Create all visible Clutter.Actors for the items.
    const createMenuItem = (item) => {
      const menuItem = new MenuItem(
          {id: item.id, caption: item.name, icon: item.icon, angle: item.angle});
      item.items.forEach(child => {
        menuItem.addMenuItem(createMenuItem(child));
      });
      return menuItem;
    };

    this._root = createMenuItem(structure);
    this._background.add_child(this._root);

    this._menuSelectionChain.push(this._root);

    this._root.setState(MenuItemState.CENTER_HOVERED, -1);
    this._root.onSettingsChange(this._settings);
    this._root.redraw();

    const itemAngles = [];
    this._root.getChildMenuItems().forEach(item => {
      itemAngles.push(item.angle);
    });
    this._selectionWedges.setItemAngles(itemAngles);

    // Calculate menu position. In edit mode, we center the menu, else we position it at
    // the mouse pointer.
    if (editMode) {
      this._root.set_translation(
          this._background.width / 2, this._background.height / 2, 0);
      this._selectionWedges.set_translation(
          this._background.width / 2, this._background.height / 2, 0);
    } else {
      const [pointerX, pointerY] = global.get_pointer();
      const [clampedX, clampedY] = this._clampToToMonitor(pointerX, pointerY, 10);
      this._root.set_translation(clampedX, clampedY, 0);
      this._selectionWedges.set_translation(clampedX, clampedY, 0);

      if (pointerX != clampedX || pointerY != clampedY) {
        this._input.warpPointer(clampedX, clampedY);
      }
    }

    return this._menuID;
  }

  // ----------------------------------------------------------------------- private stuff

  // Hides the menu and the background actor.
  _hide() {
    // The menu is not active.
    if (this._menuID == null) {
      return;
    }

    // Fade out the background actor.
    this._background.hide();

    // Rest menu ID. With this set to null, we can accept new menu requests.
    this._menuID = null;

    this._draggedChild = null;

    this._menuSelectionChain = [];
  }

  // This method recursively traverses the menu structure and assigns an ID to each
  // item. If an item already has an ID property, this is not touched. This ID will be
  // passed to the OnSelect and OnHover handlers.
  _updateItemIDs(items, parentID) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.id) {
        if (parentID) {
          item.id = parentID + '/' + i;
        } else {
          item.id = '/' + i;
        }
      }

      // Proceed recursively with the children.
      this._updateItemIDs(item.items, item.id);
    }
  }

  _createEmptyChildrenLists(item) {
    if (item.items) {
      item.items.forEach(child => {
        this._createEmptyChildrenLists(child);
      });
    } else {
      item.items = [];
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
      if ('angle' in item) {
        fixedAngles.push({angle: item.angle, index: index});
      }
    });

    // Make sure that the fixed angles increase monotonically and are between 0° and 360°.
    for (let i = 0; i < fixedAngles.length; i++) {
      if (i > 0 && fixedAngles[i].angle <= fixedAngles[i - 1].angle) {
        return false;
      }

      if (fixedAngles[i].angle < 0.0 || fixedAngles[i].angle >= 360.0) {
        return false;
      }
    }

    // Make sure that the parent link does not collide with a fixed item. For now, we
    // consider a difference of less than 1° a collision.
    if (parentAngle != undefined) {
      for (let i = 0; i < fixedAngles.length; i++) {
        if (Math.abs(fixedAngles[i].angle - parentAngle) < 1.0) {
          return false;
        }
      }
    }

    // If no item has a fixed angle, we assign one to the first item. This should be left
    // or right, depending on the position of the parent item.
    if (fixedAngles.length == 0) {
      let firstAngle = 90;
      if (parentAngle != undefined && parentAngle < 180) {
        firstAngle = 270;
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
      if (!this._updateItemAngles(item.items, (item.angle + 180) % 360)) {
        return false;
      }
    });

    return true;
  }

  // This is called every time a settings key changes.
  _onSettingsChange() {

    // Then call onSettingsChange() for each item of our menu. This ensures that the menu
    // is instantly updated in edit mode.
    this._selectionWedges.onSettingsChange(this._settings);

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

    let maxSize = wedgeRadius;
    maxSize     = Math.max(maxSize, centerRadius);
    maxSize     = Math.max(maxSize, childRadius);
    maxSize     = Math.max(maxSize, grandchildRadius);
    maxSize *= 2 * this._settings.get_double('global-scale');

    const monitor = Main.layoutManager.currentMonitor;

    const min  = margin + maxSize / 2;
    const maxX = monitor.width - min;
    const maxY = monitor.height - min;

    const posX = Math.min(Math.max(x, min), maxX);
    const posY = Math.min(Math.max(y, min), maxY);

    return [Math.floor(posX), Math.floor(posY)];
  }
};
