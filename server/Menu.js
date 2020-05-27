//////////////////////////////////////////////////////////////////////////////////////////
//                                                                                      //
//    _____                    ___  _     ___       This software may be modified       //
//   / ___/__  ___  __ _  ___ / _ \(_)__ |_  |      and distributed under the           //
//  / (_ / _ \/ _ \/  ' \/ -_) ___/ / -_) __/       terms of the MIT license. See       //
//  \___/_//_/\___/_/_/_/\__/_/  /_/\__/____/       the LICENSE file for details.       //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Clutter        = imports.gi.Clutter;
const Gio            = imports.gi.Gio;
const Gdk            = imports.gi.Gdk;
const Main           = imports.ui.main;
const ExtensionUtils = imports.misc.extensionUtils;

const Me               = ExtensionUtils.getCurrentExtension();
const DBusInterface    = Me.imports.common.DBusInterface.DBusInterface;
const debug            = Me.imports.common.debug.debug;
const InputManipulator = Me.imports.server.InputManipulator.InputManipulator;
const logProperties    = Me.imports.common.debug.logProperties;
const MenuItem         = Me.imports.server.MenuItem.MenuItem;
const Theme            = Me.imports.server.Theme.Theme;
const utils            = Me.imports.server.utils;

var Menu = class Menu {

  // ------------------------------------------------------------ constructor / destructor

  constructor(onHover, onSelect, onCancel) {

    this._theme = new Theme();

    let schema = Gio.SettingsSchemaSource.new_from_directory(
        Me.dir.get_child('schemas').get_path(), Gio.SettingsSchemaSource.get_default(),
        false);

    this._settings = new Gio.Settings(
        {settings_schema: schema.lookup('org.gnome.shell.extensions.gnomepie2', true)});

    this._onHover   = onHover;
    this._onSelect  = onSelect;
    this._onCancel  = onCancel;
    this._menuID    = null;
    this._structure = {};

    this._input = new InputManipulator();

    this._background = new Clutter.Actor({
      height: Main.layoutManager.currentMonitor.height,
      width: Main.layoutManager.currentMonitor.width,
      reactive: false,
      visible: false,
      opacity: 0
    });

    let settingSignalHandler = () => {
      let color =
          Clutter.Color.from_string(this._settings.get_string('background-color'))[1];
      this._background.backgroundColor = color;
    };

    this._settings.connect('changed::background-color', settingSignalHandler);

    settingSignalHandler();

    this._background.set_easing_duration(300);
    this._background.connect('transitions-completed', () => {
      if (this._background.opacity == 0) {
        this._background.visible = false;
      }
    });

    Main.uiGroup.add_actor(this._background);

    this._background.connect('button-release-event', (actor, event) => {
      if (event.get_button() == 3) {
        this._onCancel(this._menuID);
        this._hide();
      }
    });

    this._background.connect(
        'motion-event',
        (actor, event) => {
            // let [x, y] = event.get_coords();
            // this._structure.actor.set_position(x, y);
        });

    // For some reason this has to be set explicitly to true before it can be set to
    // false.
    global.stage.cursor_visible = true;
  }

  destroy() {
    Main.uiGroup.remove_actor(this._background);
    this._background = null;
  }

  // -------------------------------------------------------------------- public interface

  // This shows the menu, blocking all user input. A subtle animation is used to fade in
  // the menu. Returns an error code if something went wrong.
  show(menuID, structure) {

    // The menu is already active.
    if (this._menuID) {
      return DBusInterface.errorCodes.eAlreadyActive;
    }

    // Check if there is a root item list.
    if (!(structure.items && structure.items.length > 0)) {
      return DBusInterface.errorCodes.ePropertyMissing;
    }

    // Store the structure.
    this._structure = structure;

    // Calculate and verify all item angles.
    if (!this._updateItemAngles(this._structure.items)) {
      return DBusInterface.errorCodes.eInvalidAngles;
    }

    // Assign an ID to each item.
    this._updateItemIDs(this._structure.items);

    // Try to grab the complete input.
    if (!Main.pushModal(this._background)) {
      // Something went wrong while grabbing the input. Let's abort this.
      return DBusInterface.errorCodes.eUnknownError;
    }

    // debug(JSON.stringify(this._structure));

    // Everything seems alright, start opening the menu!
    this._menuID = menuID;

    // Make the background visible and clickable.
    this._background.reactive = true;
    this._background.visible  = true;

    // Add the fade-in animation.
    this._background.remove_all_children();
    this._background.opacity = 255;

    this._structure.actor = new MenuItem({
      height: 100,
      width: 100,
      reactive: false,
      icon: Gio.Icon.new_for_string(this._structure.icon),
      theme: this._theme
    });
    this._background.add_child(this._structure.actor);

    // Calculate window position.
    let [pointerX, pointerY] = global.get_pointer();
    let [posX, posY]         = this._clampToToMonitor(
        pointerX, pointerY, this._structure.actor.width, this._structure.actor.height, 8);
    this._structure.actor.set_position(posX, posY);

    this._structure.items.forEach(item => {
      item.actor = new MenuItem({
        height: 50,
        width: 50,
        reactive: false,
        icon: Gio.Icon.new_for_string(item.icon),
        theme: this._theme
      });

      let angle = item.angle * Math.PI / 180.0;
      item.actor.set_position(Math.sin(angle) * 100, -Math.cos(angle) * 100);
      this._structure.actor.insert_child_at_index(item.actor, 0);

      if (item.items) {
        item.items.forEach(child => {
          child.actor =
              new MenuItem({height: 10, width: 10, reactive: false, theme: this._theme});

          let angle = child.angle * Math.PI / 180.0;
          child.actor.set_position(Math.sin(angle) * 25, -Math.cos(angle) * 25);
          item.actor.insert_child_at_index(child.actor, 0);
        });
      }
    });

    return this._menuID;
  }

  // ----------------------------------------------------------------------- private stuff

  // Hides the menu and the background actor.
  _hide() {
    // The menu is not active.
    if (this._menuID == null) {
      return;
    }

    // Un-grab the input.
    Main.popModal(this._background);

    // Do not receive input events anymore.
    this._background.reactive = false;

    // Add the fade-out animation.
    this._background.opacity = 0;

    // Rest some members.
    this._menuID    = null;
    this._structure = {};
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
      if (item.items) {
        this._updateItemIDs(item.items, item.id);
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
    let fixedAngles = [];
    items.forEach((item, index) => {
      if (item.angle) {
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
    if (parentAngle) {
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
      if (parentAngle && parentAngle < 180) {
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
      if (wedgeBeginAngle <= wedgeEndAngle) {
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
      if (item.items) {
        if (!this._updateItemAngles(item.items, (item.angle + 180) % 360)) {
          return false;
        }
      }
    });

    return true;
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
};
