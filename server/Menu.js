//////////////////////////////////////////////////////////////////////////////////////////
//                                                                                      //
//    _____                    ___  _     ___       This software may be modified       //
//   / ___/__  ___  __ _  ___ / _ \(_)__ |_  |      and distributed under the           //
//  / (_ / _ \/ _ \/  ' \/ -_) ___/ / -_) __/       terms of the MIT license. See       //
//  \___/_//_/\___/_/_/_/\__/_/  /_/\__/____/       the LICENSE file for details.       //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Main                = imports.ui.main;
const Cairo               = imports.cairo;
const {Clutter, Gio, Gdk} = imports.gi;

const Me               = imports.misc.extensionUtils.getCurrentExtension();
const Background       = Me.imports.server.Background.Background;
const DBusInterface    = Me.imports.common.DBusInterface.DBusInterface;
const InputManipulator = Me.imports.server.InputManipulator.InputManipulator;
const MenuItem         = Me.imports.server.MenuItem.MenuItem;
const Wedges           = Me.imports.server.Wedges.Wedges;
const MenuItemState    = Me.imports.server.MenuItem.MenuItemState;
const utils            = Me.imports.common.utils;

var Menu = class Menu {

  // ------------------------------------------------------------ constructor / destructor

  constructor(onHover, onSelect, onCancel) {

    this._settings = utils.createSettings();

    this._onHover   = onHover;
    this._onSelect  = onSelect;
    this._onCancel  = onCancel;
    this._menuID    = null;
    this._structure = {};
    this._editMode  = false;

    this._input = new InputManipulator();

    this._background = new Background();
    Main.layoutManager.addChrome(this._background);

    this._wedges = new Wedges();
    this._background.add_child(this._wedges);

    this._itemBackground = this._createItemBackground();

    this._background.connect('button-release-event', (actor, event) => {
      if (event.get_button() == 3 && !this._editMode) {
        this._onCancel(this._menuID);
        this._hide();
      }
    });

    this._background.connect('edit-close', () => {
      this._onCancel(this._menuID);
      this._hide();
    });

    this._background.connect('motion-event', (actor, event) => {
      let [x, y] = event.get_coords();
      this._wedges.setPointerPosition(x - this._wedges.x, y - this._wedges.y);
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
    if (this._structure && this._structure.actor) {
      this._structure.actor.destroy();
    }

    // Store the structure.
    this._structure = structure;
    this._editMode  = editMode;

    // To avoid frequent checks for the existence of the items list member, we add an
    // empty list for items without children.
    this._createEmptyChildrenLists(this._structure);

    // Calculate and verify all item angles.
    this._structure.angle = 0;
    if (!this._updateItemAngles(this._structure.items)) {
      return DBusInterface.errorCodes.eInvalidAngles;
    }

    // Assign an ID to each item.
    this._updateItemIDs(this._structure.items);

    // Try to grab the complete input.
    if (!this._background.show(editMode)) {
      // Something went wrong while grabbing the input. Let's abort this.
      return DBusInterface.errorCodes.eUnknownError;
    }

    // Everything seems alright, start opening the menu!
    this._menuID = menuID;

    // Create all visible Clutter.Actors for the items.
    this._structure.actor = this._createActor(
        this._structure.icon, this._structure.angle, MenuItemState.ACTIVE);
    this._structure.actor.onSettingsChange(this._settings);
    this._background.add_child(this._structure.actor);

    let itemAngles = [];

    this._structure.items.forEach(item => {
      itemAngles.push(item.angle);

      item.actor = this._createActor(item.icon, item.angle, MenuItemState.CHILD);
      item.actor.onSettingsChange(this._settings);
      this._structure.actor.getChildrenContainer().add_child(item.actor);

      item.items.forEach(child => {
        child.actor =
            this._createActor(child.icon, child.angle, MenuItemState.GRANDCHILD);
        child.actor.onSettingsChange(this._settings);
        item.actor.getChildrenContainer().add_child(child.actor);
      });
    });

    this._wedges.setItemAngles(itemAngles);

    // Calculate menu position. In edit mode, we center the menu, else we position it at
    // the mouse pointer.
    this._structure.actor.set_easing_duration(0);
    if (editMode) {
      this._structure.actor.set_position(
          this._background.width / 2, this._background.height / 2);
      this._wedges.set_position(this._background.width / 2, this._background.height / 2);
    } else {
      let [x, y] = global.get_pointer();
      [x, y]     = this._clampToToMonitor(
          x, y, this._structure.actor.width, this._structure.actor.height, 8);
      this._structure.actor.set_position(x, y);
      this._wedges.set_position(x, y);
    }
    this._structure.actor.set_easing_duration(
        this._settings.get_double('animation-duration') * 1000);

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

  _createActor(icon, angle, state) {
    return new MenuItem({
      icon: icon,
      angle: angle * Math.PI / 180,
      backgroundCanvas: this._itemBackground,
      state: state
    });
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
    let fixedAngles = [];
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
      let wedgeItemGap = (wedgeEndAngle - wedgeBeginAngle) / (wedgeItemCount + 1);

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

    // First update the scale factor of our item background circle. We make it as large as
    // it can possible get. Usually this will be 'center-size' * 'global-scale', but in
    // theory children items could be scaled larger than the center, so we check all of
    // them to be on the safe side.
    let itemBackgroundSizes = [
      this._settings.get_double('center-size'),
      this._settings.get_double('child-size'),
      this._settings.get_double('child-size-hover'),
      this._settings.get_double('grandchild-size'),
      this._settings.get_double('grandchild-size-hover'),
    ];

    let maxItemBackgroundSize = 0;
    itemBackgroundSizes.forEach(size => {
      maxItemBackgroundSize = Math.max(size, maxItemBackgroundSize);
    });

    this._itemBackground.scale_factor =
        maxItemBackgroundSize * this._settings.get_double('global-scale');

    // Then call onSettingsChange() for each item of our menu. This ensures that the menu
    // is instantly updated in edit mode.
    this._foreachItem(item => {
      if (item.actor) {
        item.actor.onSettingsChange(this._settings);
      }
    });

    this._wedges.onSettingsChange(this._settings);
  }

  // For performance reasons, all menu items share the same Clutter.Canvas for their
  // background. This method creates it. It has a width and height of one.
  // Clutter.Canvas.scale_factor is later used to scale the canvas to an appropriate size.
  _createItemBackground() {
    let canvas = new Clutter.Canvas({height: 1, width: 1});

    canvas.connect('draw', (canvas, ctx, width, height) => {
      ctx.setOperator(Cairo.Operator.CLEAR);
      ctx.paint();
      ctx.setOperator(Cairo.Operator.OVER);
      ctx.scale(width, height);
      ctx.translate(0.5, 0.5);
      ctx.arc(0, 0, 0.5, 0, 2.0 * Math.PI);
      ctx.setSourceRGB(1, 1, 1);
      ctx.fill();
    });

    canvas.invalidate();

    return canvas;
  }

  // x and y are the center coordinates of a box of size [width, height]. This method
  // returns a new position [x, y] which ensures that the box is inside the current
  // monitor's bounds, including the specified padding.
  _clampToToMonitor(x, y, width, height, margin) {
    let monitor = Main.layoutManager.currentMonitor;

    let minX = margin + width / 2;
    let minY = margin + height / 2;

    let maxX = monitor.width - margin - width / 2;
    let maxY = monitor.height - margin - height / 2;

    let posX = Math.min(Math.max(x, minX), maxX);
    let posY = Math.min(Math.max(y, minY), maxY);

    return [Math.floor(posX), Math.floor(posY)];
  }

  _foreachItem(func, parentItem) {
    let item = parentItem || this._structure;

    if (item) {
      func(item);

      if (item.items) {
        item.items.forEach(child => {
          this._foreachItem(func, child);
        });
      }
    }
  }
};
