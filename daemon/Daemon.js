//////////////////////////////////////////////////////////////////////////////////////////
//   _____       _             _____ _                                                  //
//  |   __|_ _ _|_|___ ___ ___|  _  |_|___   This software may be modified and distri-  //
//  |__   | | | | |   | . |___|   __| | -_|  buted under the terms of the MIT license.  //
//  |_____|_____|_|_|_|_  |   |__|  |_|___|  See the LICENSE file for details.          //
//                    |___|                                                             //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const {Gio, GLib} = imports.gi;

const Me            = imports.misc.extensionUtils.getCurrentExtension();
const DBusInterface = Me.imports.common.DBusInterface.DBusInterface;
const Menu          = Me.imports.daemon.Menu.Menu;
const utils         = Me.imports.common.utils;
const ItemRegistry  = Me.imports.common.ItemRegistry;
const Shortcuts     = Me.imports.daemon.Shortcuts.Shortcuts;

//////////////////////////////////////////////////////////////////////////////////////////
// The daemon listens on the D-Bus for requests. For details on the interface refer to  //
// common/DBusInterface.js. When a valid request is received, an menu is shown          //
// accordingly.                                                                         //
//////////////////////////////////////////////////////////////////////////////////////////

var Daemon = class Daemon {

  // ------------------------------------------------------------ constructor / destructor

  constructor() {

    // Make the ShowMenu() method available on the D-Bus.
    this._dbus = Gio.DBusExportedObject.wrapJSObject(DBusInterface.description, this);
    this._dbus.export(Gio.DBus.session, '/org/gnome/shell/extensions/swingpie');

    // Initialize the menu.
    this._menu = new Menu(
        // Called when the user selects an item in the menu. This calls the OnSelect
        // signal of the DBusInterface.
        (menuID, path) => this._onSelect(menuID, path),

        // Called when the user does no select anything in the menu. This calls the
        // OnCancel signal of the DBusInterface.
        (menuID) => this._onCancel(menuID));

    // This is increased once for every menu request.
    this._nextID    = 0;
    this._currentID = -1;

    this._settings = utils.createSettings();

    this._shortcuts = new Shortcuts((shortcut) => {
      for (let i = 0; i < this._menus.length; i++) {
        if (shortcut == this._menus[i].data) {
          this.ShowMenu(this._menus[i].name);
        }
      }
    });

    this._settings.connect('changed::menu-configuration', () => {
      this._menus = JSON.parse(this._settings.get_string('menu-configuration'));
      this._bindShortcuts()
    });

    this._menus = JSON.parse(this._settings.get_string('menu-configuration'));
    this._bindShortcuts();
  }

  // Cleans up stuff which is not cleaned up automatically.
  destroy() {
    this._menu.destroy();
    this._dbus.unexport();
    this._shortcuts.destroy();
  }

  // -------------------------------------------------------------------- public interface

  // These are directly called via the DBus. See common/DBusInterface.js for a description
  // of Swing-Pie's DBusInterface.
  ShowMenu(name) {
    return this._openMenu(name, false);
  }

  PreviewMenu(name) {
    return this._openMenu(name, true);
  }

  ShowCustomMenu(json) {
    return this._openCustomMenu(json, false);
  }

  PreviewCustomMenu(json) {
    return this._openCustomMenu(json, true);
  }

  // ----------------------------------------------------------------------- private stuff

  _openMenu(name, previewMode) {

    for (let i = 0; i < this._menus.length; i++) {
      if (name == this._menus[i].name) {
        const menu   = this._transformItem(this._menus[i]);
        const result = this._openCustomMenu(JSON.stringify(menu), previewMode);

        if (result >= 0) {
          this._currentID = result;
          this._lastMenu  = menu;
        } else {
          utils.notification(
              'Failed to open a Swing-Pie menu: ' +
              DBusInterface.getErrorDescription(result));
        }

        break;
      }
    }
  }

  // Open the menu described by 'json', optionally in preview mode. This will return the
  // menu's ID on success or an error code on failure. See common/DBusInterface.js for a
  // list of error codes.
  _openCustomMenu(json, previewMode) {

    // First try to parse the menu structure.
    let structure;
    try {
      structure = JSON.parse(json);
    } catch (error) {
      logError(error);
      return DBusInterface.errorCodes.eInvalidJSON;
    }

    // Then try to open the menu. This will return the menu's ID on success or an error
    // code on failure.
    try {
      return this._menu.show(this._nextID++, structure, previewMode);
    } catch (error) {
      logError(error);
    }

    return DBusInterface.errorCodes.eUnknownError;
  }

  // This gets called once the user made a selection in the menu.
  _onSelect(menuID, path) {
    // For some reason it wasn't our menu.
    if (this._currentID != menuID) {
      this._dbus.emit_signal('OnSelect', GLib.Variant.new('(is)', [menuID, path]));
      return;
    }

    // The path is a string like /2/2/4 indicating that the fourth entry in the second
    // entry of the second entry was clicked on.
    const pathElements = path.split('/');

    if (pathElements.length < 2) {
      utils.debug('The server reported an impossible selection!');
    }

    // Now follow the path in our menu structure.
    let menu = this._lastMenu;
    for (let i = 1; i < pathElements.length; ++i) {
      menu = menu.children[pathElements[i]];
    }

    // And finally activate the item!
    menu.activate();

    this._currentID = -1;
  }

  // This gets called when the user did not select anything in the menu.
  _onCancel(menuID) {
    // For some reason it wasn't our menu.
    if (this._currentID != menuID) {
      this._dbus.emit_signal('OnCancel', GLib.Variant.new('(i)', [menuID]));
      return;
    }

    this._currentID = -1;
  }

  _transformItem(config) {
    const result = ItemRegistry.ItemTypes[config.type].createItem(
        config.name, config.icon, config.angle, config.data);

    // Load all children recursively.
    for (let i = 0; i < config.children.length; i++) {
      result.children.push(this._transformItem(config.children[i]));
    }

    return result;
  }

  _bindShortcuts() {
    const newShortcuts = new Set();

    for (let i = 0; i < this._menus.length; i++) {
      if (this._menus[i].data != '') {
        newShortcuts.add(this._menus[i].data);
      }
    }

    for (let existingShortcut of this._shortcuts.getBound()) {
      if (newShortcuts.has(existingShortcut)) {
        newShortcuts.delete(existingShortcut);
      } else {
        this._shortcuts.unbind(existingShortcut);
      }
    }

    for (let requiredShortcut of newShortcuts) {
      this._shortcuts.bind(requiredShortcut);
    }
  }
};