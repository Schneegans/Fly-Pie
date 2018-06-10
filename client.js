//////////////////////////////////////////////////////////////////////////////////////////
//                                                                                      //
//    _____                    ___  _     ___       This software may be modified       //
//   / ___/__  ___  __ _  ___ / _ \(_)__ |_  |      and distributed under the           //
//  / (_ / _ \/ _ \/  ' \/ -_) ___/ / -_) __/       terms of the MIT license. See       //
//  \___/_//_/\___/_/_/_/\__/_/  /_/\__/____/       the LICENSE file for details.       //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

const Lang           = imports.lang;
const Gio            = imports.gi.Gio;
const GLib           = imports.gi.GLib;
const Main           = imports.ui.main;
const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();

const DBusInterface = Me.imports.dbusInterface.DBusInterface;
const KeyBindings   = Me.imports.keyBindings.KeyBindings;
const debug         = Me.imports.debug.debug;
const MenuFactory   = Me.imports.menuFactory.MenuFactory;
const Timer         = Me.imports.timer.Timer;

const DBusWrapper = Gio.DBusProxy.makeProxyWrapper(DBusInterface);

//////////////////////////////////////////////////////////////////////////////////////////
// The Client sends ShowMenu-requests requests over the DBUS to the Server. It listens  //
// to OnSelect and OnCancel signals of the Server and executes the according actions.   //
//////////////////////////////////////////////////////////////////////////////////////////

const Client = new Lang.Class({
  Name : 'Client',

  // ------------------------------------------------------------ constructor / destructor

  _init : function() {
    this._settings = this._initSettings();

    this._keybindings = new KeyBindings();
    this._keybindings.bindShortcut(this._settings, Lang.bind(this, this.toggle));

    this._menuOpened = false;

    this._wrapper = new DBusWrapper(
      Gio.DBus.session, 'org.openpie.Daemon', '/org/openpie/Daemon/MenuService');

    this._wrapper.connectSignal('OnSelect', Lang.bind(this, this._onSelect));
    this._wrapper.connectSignal('OnHover', Lang.bind(this, this._onHover));
    this._wrapper.connectSignal('OnCancel', Lang.bind(this, this._onCancel));
  },

  destroy : function() { this._keybindings.unbindShortcut(); },

  // -------------------------------------------------------------------- public interface

  toggle : function() {
    if (this._menuOpened) {
      debug('A menu is already opend.');
      return;
    }

    this._menuOpened = true;

    let timer = new Timer();

    let factory    = new MenuFactory();
    this._lastMenu = {items : []};
    this._lastMenu.items.push(factory.getAppMenuItems());
    timer.printElapsedAndReset('[C] getAppMenuItems');
    this._lastMenu.items.push(factory.getUserDirectoriesItems());
    timer.printElapsedAndReset('[C] getUserDirectoriesItems');
    this._lastMenu.items.push(factory.getRecentItems());
    timer.printElapsedAndReset('[C] getRecentItems');
    this._lastMenu.items.push(factory.getFavoriteItems());
    timer.printElapsedAndReset('[C] getFavoriteItems');
    this._lastMenu.items.push(factory.getFrequentItems());
    timer.printElapsedAndReset('[C] getFrequentItems');
    this._lastMenu.items.push(factory.getRunningAppsItems());
    timer.printElapsedAndReset('[C] getRunningAppsItems');
    this._lastMenu.items.push({
      name : "Test",
      icon : "/home/simon/Pictures/Eigene/avatar128.png",
      activate : function() { debug("Test!"); }
    });

    timer.printElapsedAndReset('[C] avatar128');

    this._wrapper.ShowMenuSync(JSON.stringify(this._lastMenu));

    timer.printElapsedAndReset('[C] Sent request');
  },

  // ----------------------------------------------------------------------- private stuff

  _initSettings : function() {
    let path          = Me.dir.get_child('schemas').get_path();
    let defaultSource = Gio.SettingsSchemaSource.get_default();
    let source = Gio.SettingsSchemaSource.new_from_directory(path, defaultSource, false);

    let schemaId = 'org.gnome.shell.extensions.gnomepie2';
    let schema   = source.lookup(schemaId, false);

    if (!schema) {
      debug('Schema ' + schemaId + ' could not be found in the path ' + path);
    }

    return new Gio.Settings({settings_schema : schema});
  },

  _onSelect : function(proxy, sender, [ path ]) {
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

    this._menuOpened = false;
  },

  _onHover : function(proxy, sender, [ path ]) {
    let pathElements = path.split('/');

    if (pathElements.length < 2) {
      debug('The server reported an impossibly hovered item!');
    }

    let menu = this._lastMenu;

    for (let i = 1; i < pathElements.length; ++i) {
      menu = menu.items[pathElements[i]];
    }

    debug('Hovering ' + path);
    // menu.activate();
  },

  _onCancel : function(proxy, sender) {
    debug('Canceled');
    this._menuOpened = false;
  }
});
