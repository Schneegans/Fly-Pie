//////////////////////////////////////////////////////////////////////////////////////////
//   _____       _             _____ _                                                  //
//  |   __|_ _ _|_|___ ___ ___|  _  |_|___   This software may be modified and distri-  //
//  |__   | | | | |   | . |___|   __| | -_|  buted under the terms of the MIT license.  //
//  |_____|_____|_|_|_|_  |   |__|  |_|___|  See the LICENSE file for details.          //
//                    |___|                                                             //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const {Gio, GLib} = imports.gi;

const Me            = imports.misc.extensionUtils.getCurrentExtension();
const DBusInterface = Me.imports.common.DBusInterface.DBusInterface;
const Menu          = Me.imports.server.Menu.Menu;

//////////////////////////////////////////////////////////////////////////////////////////
// The server listens on the D-Bus for requests. For details on the interface refer to  //
// common/DBusInterface.js. When a valid request is received, an menu is shown          //
// accordingly.                                                                         //
//////////////////////////////////////////////////////////////////////////////////////////

var Server = class Server {

  // ------------------------------------------------------------ constructor / destructor

  constructor() {

    // Make the ShowMenu() method available on the D-Bus.
    this._dbus = Gio.DBusExportedObject.wrapJSObject(DBusInterface.description, this);
    this._dbus.export(Gio.DBus.session, '/org/gnome/shell/extensions/swingpie');

    // Initialize the menu.
    this._menu = new Menu(
        // Called when the user hovers over an item in the menu. This calls the
        // OnHover signal of the DBusInterface.
        (menuID, item) =>
            this._dbus.emit_signal('OnHover', GLib.Variant.new('(is)', [menuID, item])),

        // Called when the user selects an item in the menu. This calls the OnSelect
        // signal of the DBusInterface.
        (menuID, item) =>
            this._dbus.emit_signal('OnSelect', GLib.Variant.new('(is)', [menuID, item])),

        // Called when the user does no select anything in the menu. This calls the
        // OnCancel signal of the DBusInterface.
        (menuID) =>
            this._dbus.emit_signal('OnCancel', GLib.Variant.new('(i)', [menuID])));

    // This is increased once for every menu request.
    this._nextID = 0;
  }

  // Cleans up stuff which is not cleaned up automatically.
  destroy() {
    this._menu.destroy();
    this._dbus.unexport();
  }

  // -------------------------------------------------------------------- public interface

  // These are directly called via the DBus. See common/DBusInterface.js for a description
  // of Swing-Pie's DBusInterface.
  ShowMenu(json) {
    return this._openMenu(json, false);
  }

  EditMenu(json) {
    return this._openMenu(json, true);
  }

  // ----------------------------------------------------------------------- private stuff

  // Open the menu described by 'json', optionally in edit mode. This will return the
  // menu's ID on success or an error code on failure. See common/DBusInterface.js for a
  // list of error codes.
  _openMenu(json, editMode) {

    // First try to parse the menu structure.
    let structure;
    try {
      structure = JSON.parse(json);
    } catch (error) {
      logError(error);
      return DBusInterface.errorCodes.eInvalidJSON;
    }

    // Then try to open the menu. This will return the menu's ID on success or an error
    // code on failure.
    try {
      return this._menu.show(this._nextID++, structure, editMode);
    } catch (error) {
      logError(error);
    }

    return DBusInterface.errorCodes.eUnknownError;
  }
};