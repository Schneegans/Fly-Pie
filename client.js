/////////////////////////////////////////////////////////////////////////////////////////
//                                                                                     //
//    _____                    ___  _     ___       This software may be modified      //
//   / ___/__  ___  __ _  ___ / _ \(_)__ |_  |      and distributed under the          //
//  / (_ / _ \/ _ \/  ' \/ -_) ___/ / -_) __/       terms of the MIT license. See      //
//  \___/_//_/\___/_/_/_/\__/_/  /_/\__/____/       the LICENSE file for details.      //
//                                                                                     //
//  Authors: Simon Schneegans (code@simonschneegans.de)                                //
//                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////

const Lang           = imports.lang;
const Gio            = imports.gi.Gio;
const GLib           = imports.gi.GLib;
const Main           = imports.ui.main;
const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();

const DBusInterface  = Me.imports.dbusInterface.DBusInterface;
const KeyBindings    = Me.imports.keyBindings.KeyBindings;
const debug          = Me.imports.debug.debug;

const DBusWrapper    = Gio.DBusProxy.makeProxyWrapper(DBusInterface);

const Client = new Lang.Class({
  Name : 'Client',

  // ----------------------------------------------------------- constructor / destructor

  _init : function () {
    this._settings = this._initSettings();
    
    this._keybindings = new KeyBindings();
    this._keybindings.bindShortcut(this._settings, Lang.bind(this, this.toggle));

    this._openMenuID = 0;

    new DBusWrapper(Gio.DBus.session, "org.gnome.Shell", 
      "/org/gnome/shell/extensions/gnomepie2", Lang.bind(this, function(wrapper) {
        this._wrapper = wrapper;
        this._wrapper.connectSignal("OnSelect", Lang.bind(this, this._onSelect));
        this._wrapper.connectSignal("OnCancel", Lang.bind(this, this._onCancel));
      })
    );
  },

  destroy : function() {
    this._keybindings.unbindShortcut();
  },

  // ------------------------------------------------------------------- public interface

  toggle : function () {
    if (this._openMenuID > 0) {
      debug("A menu is already opend.");
      return;
    }

    if (this._openMenuID < 0) {
      debug("A menu open request is still pending.");
      return;
    }

    // a menu is about to be opened, however we did not get an ID yet
    this._openMenuID = -1;

    let menu = '{"name":"foo","icon":"link","subs":[{"name":"Firefox","icon":"firefox"},{"name":"Thunderbird","icon":"thunderbird"}]}';
    this._wrapper.ShowMenuRemote(menu, Lang.bind(this, function(id) {
      if (id > 0) {
        // the menu has been shown successfully - we store the ID and wait for a call of
        // _onSelect or _onCancel
        this._openMenuID = id;
        debug("Got ID: " + id);
      } else {
        debug("The server reported an error showing the menu!");
      }
    }));
  },

  // ---------------------------------------------------------------------- private stuff

  _initSettings : function () {
    let path = Me.dir.get_child('schemas').get_path();
    let defaultSource = Gio.SettingsSchemaSource.get_default();
    let source = Gio.SettingsSchemaSource.new_from_directory(path, defaultSource, false);

    let schemaId = "org.gnome.shell.extensions.gnomepie2";
    let schema = source.lookup(schemaId, false); 

    if (!schema) {
      debug("Schema " + schemaId + " could not be found in the path " + path);
    }

    return new Gio.Settings({settings_schema : schema});
  },

  _onSelect : function(proxy, sender, [id, item]) {
    if (id == this._openMenuID) {
      debug("Selected: " + item);
      this._openMenuID = 0;
    }
  },

  _onCancel : function(proxy, sender, [id]) {
    if (id == this._openMenuID) {
      debug("Canceled: " + id);
      this._openMenuID = 0;
    }
  }
});
