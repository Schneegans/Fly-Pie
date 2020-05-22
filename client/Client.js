//////////////////////////////////////////////////////////////////////////////////////////
//                                                                                      //
//    _____                    ___  _     ___       This software may be modified       //
//   / ___/__  ___  __ _  ___ / _ \(_)__ |_  |      and distributed under the           //
//  / (_ / _ \/ _ \/  ' \/ -_) ___/ / -_) __/       terms of the MIT license. See       //
//  \___/_//_/\___/_/_/_/\__/_/  /_/\__/____/       the LICENSE file for details.       //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Gio            = imports.gi.Gio;
const ExtensionUtils = imports.misc.extensionUtils;
const Me             = ExtensionUtils.getCurrentExtension();

const debug         = Me.imports.common.debug.debug;
const Timer         = Me.imports.common.Timer.Timer;
const DBusInterface = Me.imports.common.DBusInterface.DBusInterface;
const KeyBindings   = Me.imports.client.KeyBindings.KeyBindings;
const MenuFactory   = Me.imports.client.MenuFactory.MenuFactory;

const DBusWrapper = Gio.DBusProxy.makeProxyWrapper(DBusInterface);

//////////////////////////////////////////////////////////////////////////////////////////
// The Client sends ShowMenu-requests requests over the DBUS to the Server. It listens  //
// to OnSelect, OnHover and OnCancel signals of the Server and executes the according   //
// actions.                                                                             //
//////////////////////////////////////////////////////////////////////////////////////////

var Client = class Client {

  // ------------------------------------------------------------ constructor / destructor

  constructor() {
    this._settings = this._initSettings();

    this._keybindings = new KeyBindings();
    this._keybindings.bindShortcut(this._settings, () => this.toggle());

    this._lastID = -1;

    // Create DBUS wrapper asynchronously.
    this._dbus = null;

    new DBusWrapper(
      Gio.DBus.session,
      'org.gnome.Shell',
      '/org/gnome/shell/extensions/gnomepie2',
      (proxy) => {
        this._dbus = proxy;
        this._dbus.connectSignal('OnSelect', (...args) => this._onSelect(...args));
        this._dbus.connectSignal('OnHover', (...args) => this._onHover(...args));
        this._dbus.connectSignal('OnCancel', (...args) => this._onCancel(...args));
      });
  }

  destroy() { this._keybindings.unbindShortcut(); }

  // -------------------------------------------------------------------- public interface

  toggle() {
    if (!this._dbus) {
      debug('Not connected to the D-Bus.');
      return;
    }

    if (this._lastID >= 0) {
      debug('A menu is already opened.');
      return;
    }

    let timer = new Timer();

    let factory = new MenuFactory();
    // this._lastMenu = {
    //   "items" : [
    //     {"name" : "Foo", "icon" : "terminal"},
    //     {
    //       "name" : "Applications",
    //       "icon" : "applications-system",
    //       "items" : [
    //         {"name" : "Gedit", "icon" : "gedit"},
    //         {"name" : "Terminal", "icon" : "firefox"},
    //         {"name" : "Nautilus", "icon" : "cheese"}
    //       ]
    //     }
    //   ]
    // };
    this._lastMenu = {items : []};
    this._lastMenu.items.push(factory.getAppMenuItems());
    this._lastMenu.items.push(factory.getUserDirectoriesItems());
    this._lastMenu.items.push(factory.getRecentItems());
    this._lastMenu.items.push(factory.getFavoriteItems());
    this._lastMenu.items.push(factory.getFrequentItems());
    this._lastMenu.items.push(factory.getRunningAppsItems());
    this._lastMenu.items.push({
      name : "Test",
      icon : "/home/simon/Pictures/Eigene/avatar128.png",
      activate : function() { debug("Test!"); }
    });

    timer.printElapsedAndReset('[C] Create menu');

    try {
      this._dbus.ShowMenuRemote(JSON.stringify(this._lastMenu), (id) => {
        this._lastID = id;
        debug("Opened menu " + this._lastID);
      });
    } catch (e) { debug(e.message); }

    timer.printElapsedAndReset('[C] Sent request');
  }

  // ----------------------------------------------------------------------- private stuff

  _initSettings() {
    let path          = Me.dir.get_child('schemas').get_path();
    let defaultSource = Gio.SettingsSchemaSource.get_default();
    let source = Gio.SettingsSchemaSource.new_from_directory(path, defaultSource, false);

    let schemaId = 'org.gnome.shell.extensions.gnomepie2';
    let schema   = source.lookup(schemaId, false);

    if (!schema) {
      debug('Schema ' + schemaId + ' could not be found in the path ' + path);
    }

    return new Gio.Settings({settings_schema : schema});
  }

  _onSelect(proxy, sender, [ id, path ]) {
    let pathElements = path.split('/');

    debug('OnSelect ' + path);
    if (pathElements.length < 2) {
      debug('The server reported an impossible selection!');
    }

    let menu = this._lastMenu;

    for (let i = 1; i < pathElements.length; ++i) {
      menu = menu.items[pathElements[i]];
    }

    menu.activate();

    this._lastID = -1;
  }

  _onHover(proxy, sender, [ id, path ]) { debug('Hovering ' + path); }

  _onCancel(proxy, sender, [ id ]) {
    debug('Canceled ' + id);
    this._lastID = -1;
  }
};
