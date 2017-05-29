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

const TileMenu       = Me.imports.tileMenu.TileMenu;
const DBusInterface  = Me.imports.dbusInterface;
const debug          = Me.imports.debug.debug;

/////////////////////////////////////////////////////////////////////////////////////////
// The server listens on the DBus for requests. For details on the interface refer to  //
// dbusInterface.js. When a valid request is received, an menu is shown accordingly.   //
/////////////////////////////////////////////////////////////////////////////////////////

const Server = new Lang.Class({
  Name : 'Server',

  // ----------------------------------------------------------- constructor / destructor

  _init : function () {
    this._bus = Gio.DBusExportedObject.wrapJSObject(DBusInterface.DBusInterface, this);
    this._bus.export(Gio.DBus.session, "/org/gnome/shell/extensions/gnomepie2");

    this._menu = new TileMenu();
    this._nextID = 1;
    this._openMenus = {};
  },

  destroy : function() {
    this._menu.destroy();
    this._bus.unexport();
  },

  // ------------------------------------------------------------------- public interface

  ShowMenu : function(description) {

    debug("Got a request: " + description);

    try {
      var menu = JSON.parse(description);
    } catch (error) {
      debug("failed to parse menu: " + error);
      return -1;
    }

    this._debugPrintMenu(menu, 0);

    if (!this._menu.show()) {
      debug("failed to show menu!");
      return -1;
    }
    // this._bus.emit_signal("OnSelect", GLib.Variant.new("(is)", [42, "ForkUserShellFailed"]));
    // this._bus.emit_signal("OnCancel", GLib.Variant.new("(i)", [42]));

    let id = this._nextID++

    this._openMenus[id] = menu;


    return id;
  },

  // ---------------------------------------------------------------------- private stuff

  _debugPrintMenu(menu, indent) {

    let name = menu.name ? menu.name : "No Name";
    let icon = menu.icon ? menu.icon : "No Icon";
    debug("  ".repeat(indent) + name + " (" + icon + ")");

    if (menu.subs) {
      for (let item of menu.subs) {
        this._debugPrintMenu(item, indent+1);
      }
    }
  }
});
