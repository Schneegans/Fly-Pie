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

const DBusInterface = Me.imports.common.dbusInterface;
const debug         = Me.imports.common.debug.debug;
const Timer         = Me.imports.common.timer.Timer;
const TileMenu      = Me.imports.server.tileMenu.TileMenu;

//////////////////////////////////////////////////////////////////////////////////////////
// The server listens on the DBus for requests. For details on the interface refer to   //
// dbusInterface.js. When a valid request is received, an menu is shown accordingly.    //
//////////////////////////////////////////////////////////////////////////////////////////

var Server = class Server {

  // ------------------------------------------------------------ constructor / destructor

  constructor() {
    this._bus = Gio.DBusExportedObject.wrapJSObject(DBusInterface.DBusInterface, this);
    this._bus.export(Gio.DBus.session, '/org/gnome/shell/extensions/gnomepie2');

    this._menu      = new TileMenu(() => this._onSelect(), () => this._onCancel());
    this._nextID    = 1;
    this._currentID = 0;
  }

  destroy() {
    this._menu.destroy();
    this._bus.unexport();
  }

  // -------------------------------------------------------------------- public interface

  ShowMenu(description) {
    if (this._currentID > 0) { return -1; }

    let timer = new Timer();

    try {
      var menu = JSON.parse(description);
    }

    catch (error) {
      debug('Failed to parse menu: ' + error);
      return -1;
    }

    timer.printElapsedAndReset('[S] Parse menu');

    if (!this._menu.show(menu)) {
      debug('Failed to show menu!');
      return -1;
    }

    this._currentID = this._nextID++;
    return this._currentID;
  }

  // ----------------------------------------------------------------------- private stuff

  _onSelect(item) {
    this._bus.emit_signal(
      'OnSelect', GLib.Variant.new('(is)', [ this._currentID, item ]));
    this._currentID = 0;
  }

  _onCancel() {
    this._bus.emit_signal('OnCancel', GLib.Variant.new('(i)', [ this._currentID ]));
    this._currentID = 0;
  }

  _debugPrintMenu(menu, indent) {
    let name = menu.name ? menu.name : 'No Name';
    let icon = menu.icon ? menu.icon : 'No Icon';
    debug('  '.repeat(indent) + name + ' (' + icon + ')');

    if (menu.items) {
      for (let item of menu.items) {
        this._debugPrintMenu(item, indent + 1);
      }
    }
  }
};