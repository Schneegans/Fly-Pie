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

    new DBusWrapper(Gio.DBus.session, "org.gnome.Shell", 
      "/org/gnome/shell/extensions/gnomepie2", Lang.bind(this, function(wrapper) {
        this._wrapper = wrapper;
        debug('foo');
      })
    );
  },

  destroy : function() {
    this._keybindings.unbindShortcut();
  },

  // ------------------------------------------------------------------- public interface

  toggle : function () {
    let menu = '{"name":"foo","icon":"link","subs":[{"name":"bar","icon":"user"},{"name":"horst","icon":"pixel"}]}';
    this._wrapper.ShowMenuRemote(menu, Lang.bind(this, function(id) {
      debug("ID: " + id);
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
      throw new Error("Schema " + schemaId + " could not be found in the path " + path);
    }

    return new Gio.Settings({settings_schema : schema});
  }
});
