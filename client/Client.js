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
// The Client sends ShowMenu-requests requests over the D-Bus to the Server. It listens //
// to OnSelect, OnHover and OnCancel signals of the Server and executes the according   //
// actions.                                                                             //
//////////////////////////////////////////////////////////////////////////////////////////

var Client = class Client {

  // ------------------------------------------------------------ constructor / destructor

  constructor() {
    let schema = Gio.SettingsSchemaSource.new_from_directory(
      Me.dir.get_child('schemas').get_path(),
      Gio.SettingsSchemaSource.get_default(),
      false);

    this._settings = new Gio.Settings(
      {settings_schema : schema.lookup('org.gnome.shell.extensions.gnomepie2', true)});

    KeyBindings.bindShortcut(this._settings, "toggle-shortcut", () => this.toggle());

    this._lastID = -1;

    // Create D-Bus wrapper asynchronously.
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

  destroy() { KeyBindings.unbindShortcut("toggle-shortcut"); }

  // -------------------------------------------------------------------- public interface

  toggle() {
    // We cannot open a menu when not connected to the D-Bus.
    if (!this._dbus) {
      debug('Not connected to the D-Bus.');
      return;
    }

    // We already have a pending request.
    if (this._lastID >= 0) {
      debug('A menu is already opened.');
      return;
    }

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
    this._lastMenu.items.push(MenuFactory.getAppMenuItems());
    this._lastMenu.items.push(MenuFactory.getUserDirectoriesItems());
    this._lastMenu.items.push(MenuFactory.getRecentItems());
    this._lastMenu.items.push(MenuFactory.getFavoriteItems());
    this._lastMenu.items.push(MenuFactory.getFrequentItems());
    this._lastMenu.items.push(MenuFactory.getRunningAppsItems());
    this._lastMenu.items.push({
      name : "Test",
      icon : "/home/simon/Pictures/Eigene/avatar128.png",
      activate : function() { debug("Test!"); }
    });

    try {
      // Open the menu on the server side. Once this is done sucessfully, we store the
      // returned menu ID.
      this._dbus.ShowMenuRemote(JSON.stringify(this._lastMenu), (id) => {
        this._lastID = id;
        debug("Opened menu " + this._lastID);
      });
    } catch (e) { debug(e.message); }
  }

  // ----------------------------------------------------------------------- private stuff

  // This gets called once the user made a selection in the menu.
  _onSelect(proxy, sender, [ id, path ]) {

    // For some reason it wasn't our menu.
    if (this._lastID != id) { return; }

    // The path is a string like /2/2/4 indicating that the fourth entry in the second
    // entry of the second entry was clicked on.
    let pathElements = path.split('/');

    debug('OnSelect ' + path);

    if (pathElements.length < 2) {
      debug('The server reported an impossible selection!');
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
  _onHover(proxy, sender, [ id, path ]) {

    // For some reason it wasn't our menu.
    if (this._lastID != id) { return; }

    debug('Hovering ' + path);
  }

  // This gets called when the user did not select anything in the menu.
  _onCancel(proxy, sender, [ id ]) {

    // For some reason it wasn't our menu.
    if (this._lastID != id) { return; }

    debug('Canceled ' + id);
    this._lastID = -1;
  }
};
