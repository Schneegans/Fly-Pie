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

const PieWindow      = Me.imports.pieWindow;
const DBusInterface  = Me.imports.dbusInterface;

const Server = new Lang.Class({
  Name : 'Server',

  _init : function () {
    this._bus = Gio.DBusExportedObject.wrapJSObject(DBusInterface.DBusInterface, this);
    this._bus.export(Gio.DBus.session, "/org/gnome/shell/extensions/gnomepie2");

    this._pieWindow = new PieWindow.PieWindow(Main.layoutManager.primaryMonitor);
  },

  destroy : function() {
    this._pieWindow.destroy();
    this._bus.unexport();
  },

  ShowMenu : function(description) {

    log("gnomepie2: Got a request: " + description);

    try {
      var menu = JSON.parse(description);
    } catch (error) {
      log("gnomepie2: failed to parse menu: " + error);
      return -1;
    }

    this._debugPrintMenu(menu, 0);

    this._pieWindow.toggle();
    // this._bus.emit_signal("OnSelect", GLib.Variant.new("(is)", [42, "ForkUserShellFailed"]));
    // this._bus.emit_signal("OnCancel", GLib.Variant.new("(i)", [42]));

    return 42;
  },

  _debugPrintMenu(menu, indent) {

    let name = menu.name ? menu.name : "No Name";
    let icon = menu.icon ? menu.icon : "No Icon";
    log("gnomepie2: " + "  ".repeat(indent) + name + " (" + icon + ")");

    if (menu.subs) {
      for (let item of menu.subs) {
        this._debugPrintMenu(item, indent+1);
      }
    }
  }
});
