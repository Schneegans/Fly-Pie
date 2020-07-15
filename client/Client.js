//////////////////////////////////////////////////////////////////////////////////////////
//   _____       _             _____ _                                                  //
//  |   __|_ _ _|_|___ ___ ___|  _  |_|___   This software may be modified and distri-  //
//  |__   | | | | |   | . |___|   __| | -_|  buted under the terms of the MIT license.  //
//  |_____|_____|_|_|_|_  |   |__|  |_|___|  See the LICENSE file for details.          //
//                    |___|                                                             //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Gio = imports.gi.Gio;

const Me               = imports.misc.extensionUtils.getCurrentExtension();
const utils            = Me.imports.common.utils;
const Timer            = Me.imports.common.Timer.Timer;
const InputManipulator = Me.imports.common.InputManipulator.InputManipulator;
const DBusInterface    = Me.imports.common.DBusInterface.DBusInterface;
const ItemRegistry     = Me.imports.common.ItemRegistry;
const Shortcuts        = Me.imports.client.Shortcuts.Shortcuts;

const DBusWrapper = Gio.DBusProxy.makeProxyWrapper(DBusInterface.description);

//////////////////////////////////////////////////////////////////////////////////////////
// The Client sends ShowMenu-requests requests over the D-Bus to the Server. It listens //
// to OnSelect and OnCancel signals of the Server and executes the according actions.   //
//////////////////////////////////////////////////////////////////////////////////////////

var Client = class Client {
  // ------------------------------------------------------------ constructor / destructor

  constructor() {
    this._settings  = utils.createSettings();
    this._input     = new InputManipulator();
    this._shortcuts = new Shortcuts((shortcut) => {
      for (let i = 0; i < this._menus.length; i++) {
        if (shortcut == this._menus[i].data) {
          this._showMenu(this._menus[i]);
        }
      }
    });

    this._settings.connect(
        'changed::menu-configuration', () => this._onConfigurationChanged());

    this._lastID = -1;

    // Create D-Bus wrapper asynchronously.
    this._dbus = null;

    new DBusWrapper(
        Gio.DBus.session, 'org.gnome.Shell', '/org/gnome/shell/extensions/swingpie',
        (proxy) => {
          this._dbus = proxy;
          this._dbus.connectSignal('OnSelect', (...args) => this._onSelect(...args));
          this._dbus.connectSignal('OnCancel', (...args) => this._onCancel(...args));
        });

    this._onConfigurationChanged();
  }

  destroy() {
    this._shortcuts.unbind('<ctrl>4');
    this._shortcuts.destroy();
  }

  // ----------------------------------------------------------------------- private stuff

  _showMenu(menuConfig) {
    // We cannot open a menu when not connected to the D-Bus.
    if (!this._dbus) {
      utils.debug('Not connected to the D-Bus.');
      return;
    }

    let menu = this._transformItem(menuConfig);

    try {
      // Open the menu on the server side. Once this is done successfully, we store the
      // returned menu ID.
      this._dbus.ShowMenuRemote(JSON.stringify(menu), (result) => {
        result = parseInt(result);
        if (result >= 0) {
          this._lastID   = result;
          this._lastMenu = menu;
          utils.debug('Opened menu ' + this._lastID);
        } else {
          utils.notification(
              'Failed to open a Swing-Pie menu: ' +
              DBusInterface.getErrorDescription(result));
        }
      });
    } catch (e) {
      utils.debug(e.message);
    }
  }

  // This is called recursively.
  _transformItem(config) {
    const result = ItemRegistry.ItemTypes[config.type].createItem(
        config.name, config.icon, config.angle, config.data);

    // Load all children recursively.
    for (let i = 0; i < config.children.length; i++) {
      result.children.push(this._transformItem(config.children[i]));
    }

    return result;
  }

  _onConfigurationChanged() {
    this._menus = JSON.parse(this._settings.get_string('menu-configuration'));

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

  // This gets called once the user made a selection in the menu.
  _onSelect(proxy, sender, [id, path]) {
    // For some reason it wasn't our menu.
    if (this._lastID != id) {
      return;
    }

    // The path is a string like /2/2/4 indicating that the fourth entry in the second
    // entry of the second entry was clicked on.
    const pathElements = path.split('/');

    utils.debug('OnSelect ' + path);

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

    this._lastID = -1;
  }

  // This gets called when the user did not select anything in the menu.
  _onCancel(proxy, sender, [id]) {
    // For some reason it wasn't our menu.
    if (this._lastID != id) {
      return;
    }

    utils.debug('Canceled ' + id);
    this._lastID = -1;
  }
};
