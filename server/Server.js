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
const GLib           = imports.gi.GLib;
const Main           = imports.ui.main;
const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();

const DBusInterface = Me.imports.common.DBusInterface.DBusInterface;
const debug         = Me.imports.common.debug.debug;
const TileMenu      = Me.imports.server.TileMenu.TileMenu;

//////////////////////////////////////////////////////////////////////////////////////////
// The server listens on the DBus for requests. For details on the interface refer to   //
// common/DBusInterface.js. When a valid request is received, an menu is shown          //
// accordingly.                                                                         //
//////////////////////////////////////////////////////////////////////////////////////////

var Server = class Server {

  // ------------------------------------------------------------ constructor / destructor

  constructor() {
    this._dbus = Gio.DBusExportedObject.wrapJSObject(DBusInterface, this);
    this._dbus.export(Gio.DBus.session, '/org/gnome/shell/extensions/gnomepie2');

    this._menu = new TileMenu((item) => this._onSelect(item), () => this._onCancel());

    this._nextID    = 0;
    this._currentID = -1;
  }

  destroy() {
    this._menu.destroy();
    this._dbus.unexport();
  }

  // -------------------------------------------------------------------- public interface

  // This is directly called via the DBus. See common/DBusInterface.js for a description
  // of Gnome-Pie 2's DBusInterface.
  ShowMenu(description) {
    if (this._currentID >= 0) {
      return -1;
    }

    let menu;

    try {
      menu = JSON.parse(description);
    } catch (error) {
      debug('Failed to parse menu: ' + error);
      return -1;
    }

    if (!this._menu.show(menu)) {
      debug('Failed to show menu!');
      return -1;
    }

    this._currentID = this._nextID++;
    return this._currentID;
  }

  // ----------------------------------------------------------------------- private stuff

  // Called when the user selects an item in the menu. This calls the OnSelect signal of
  // the DBusInterface.
  _onSelect(item) {
    this._dbus.emit_signal('OnSelect',
                           GLib.Variant.new('(is)', [ this._currentID, item ]));
    this._currentID = -1;
  }

  // Called when the user does no select anything in the menu. This calls the OnCancel
  // signal of the DBusInterface.
  _onCancel() {
    this._dbus.emit_signal('OnCancel', GLib.Variant.new('(i)', [ this._currentID ]));
    this._currentID = -1;
  }
};