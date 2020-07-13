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
const KeyBindings      = Me.imports.client.KeyBindings.KeyBindings;


const DBusWrapper = Gio.DBusProxy.makeProxyWrapper(DBusInterface.description);

//////////////////////////////////////////////////////////////////////////////////////////
// The Client sends ShowMenu-requests requests over the D-Bus to the Server. It listens //
// to OnSelect, OnHover and OnCancel signals of the Server and executes the according   //
// actions.                                                                             //
//////////////////////////////////////////////////////////////////////////////////////////

var Client = class Client {
  // ------------------------------------------------------------ constructor / destructor

  constructor() {
    this._settings = utils.createSettings();
    this._input    = new InputManipulator();


    KeyBindings.bindShortcut(this._settings, 'toggle-shortcut', () => this.toggle());

    this._lastID = -1;

    // Create D-Bus wrapper asynchronously.
    this._dbus = null;

    new DBusWrapper(
        Gio.DBus.session, 'org.gnome.Shell', '/org/gnome/shell/extensions/swingpie',
        (proxy) => {
          this._dbus = proxy;
          this._dbus.connectSignal('OnSelect', (...args) => this._onSelect(...args));
          this._dbus.connectSignal('OnHover', (...args) => this._onHover(...args));
          this._dbus.connectSignal('OnCancel', (...args) => this._onCancel(...args));
        });
  }

  destroy() {
    KeyBindings.unbindShortcut('toggle-shortcut');
  }

  // -------------------------------------------------------------------- public interface

  toggle() {
    // We cannot open a menu when not connected to the D-Bus.
    if (!this._dbus) {
      utils.debug('Not connected to the D-Bus.');
      return;
    }

    let menu = {icon: 'firefox', name: 'Main Menu', items: []};

    menu.items.push(ItemRegistry.ItemTypes.Hotkey.createItem(
        'Undo', '/home/simon/Pictures/Eigene/avatar128.png', '<Ctrl>Z'));
    menu.items.push(
        ItemRegistry.ItemTypes.Command.createItem('Firefox', 'firefox', 'firefox'));
    menu.items.push(ItemRegistry.ItemTypes.MainMenu.createItem(
        ItemRegistry.ItemTypes.MainMenu.name, ItemRegistry.ItemTypes.MainMenu.icon));
    menu.items.push(ItemRegistry.ItemTypes.Bookmarks.createItem(
        ItemRegistry.ItemTypes.Bookmarks.name, ItemRegistry.ItemTypes.Bookmarks.icon));
    menu.items.push(ItemRegistry.ItemTypes.RecentFiles.createItem(
        ItemRegistry.ItemTypes.RecentFiles.name, ItemRegistry.ItemTypes.RecentFiles.icon,
        9));
    menu.items.push(ItemRegistry.ItemTypes.Favorites.createItem(
        ItemRegistry.ItemTypes.Favorites.name, ItemRegistry.ItemTypes.Favorites.icon));
    menu.items.push(ItemRegistry.ItemTypes.FrequentlyUsed.createItem(
        ItemRegistry.ItemTypes.FrequentlyUsed.name,
        ItemRegistry.ItemTypes.FrequentlyUsed.icon, 9));
    menu.items.push(ItemRegistry.ItemTypes.RunningApps.createItem(
        ItemRegistry.ItemTypes.RunningApps.name,
        ItemRegistry.ItemTypes.RunningApps.icon));

    try {
      // Open the menu on the server side. Once this is done successfully, we store the
      // returned menu ID.
      this._dbus.ShowMenuRemote(JSON.stringify(menu), (id) => {
        if (id) {
          if (id >= 0) {
            this._lastID   = id;
            this._lastMenu = menu;
            utils.debug('Opened menu ' + this._lastID);
          } else {
            Main.notifyError('Failed to open a Swing-Pie menu!');
          }
        }
      });
    } catch (e) {
      utils.debug(e.message);
    }
  }

  // ----------------------------------------------------------------------- private stuff

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
      menu = menu.items[pathElements[i]];
    }

    // And finally activate the item!
    menu.activate();

    this._lastID = -1;
  }

  // This gets called when the user hovers over an item, potentially selecting it. This
  // could be used to preview something, but we do not use it here.
  _onHover(proxy, sender, [id, path]) {
    // For some reason it wasn't our menu.
    if (this._lastID != id) {
      return;
    }

    utils.debug('Hovering ' + path);
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
