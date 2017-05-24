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

const Lang = imports.lang;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Main           = imports.ui.main;
const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();
const PieWindow = Me.imports.pieWindow;

const GnomePieInterface =
  '<node>                                                    \
    <interface name="org.gnome.shell.extensions.gnomepie2">  \
        <method name="ShowMenu">                             \
          <arg name="description" type="s" direction="in"/>  \
          <arg name="id" type="i" direction="out"/>          \
        </method>                                            \
        <signal name="OnSelect">                             \
            <arg type="i" name="id"/>                        \
            <arg type="s" name="item"/>                      \
        </signal>                                            \
        <signal name="OnCancel">                             \
            <arg type="i" name="id"/>                        \
        </signal>                                            \
    </interface>                                             \
  </node>';

const DBusInterface = new Lang.Class({
  Name : 'DBusInterface',

  _init : function () {
    this._bus = Gio.DBusExportedObject.wrapJSObject(GnomePieInterface, this);
    this._bus.export(Gio.DBus.session, "/org/gnome/shell/extensions/gnomepie2");

    this._pieWindow = new PieWindow.PieWindow(Main.layoutManager.primaryMonitor);
  },

  ShowMenu : function(description) {
    this._pieWindow.toggle();
    // this._bus.emit_signal("OnSelect", GLib.Variant.new("(is)", [42, "ForkUserShellFailed"]));
    // this._bus.emit_signal("OnCancel", GLib.Variant.new("(i)", [42]));

    log("gnomepie2: " + description);

    return 42;

  }
});
