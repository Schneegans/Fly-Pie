//////////////////////////////////////////////////////////////////////////////////////////
//   _____       _             _____ _                                                  //
//  |   __|_ _ _|_|___ ___ ___|  _  |_|___   This software may be modified and distri-  //
//  |__   | | | | |   | . |___|   __| | -_|  buted under the terms of the MIT license.  //
//  |_____|_____|_|_|_|_  |   |__|  |_|___|  See the LICENSE file for details.          //
//                    |___|                                                             //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Main          = imports.ui.main;
const {Shell, Meta} = imports.gi;

const Me    = imports.misc.extensionUtils.getCurrentExtension();
const utils = Me.imports.common.utils;

//////////////////////////////////////////////////////////////////////////////////////////
// This class can be used to bind functions to global hot keys.                         //
//////////////////////////////////////////////////////////////////////////////////////////

var Shortcuts = class Shortcuts {

  // ------------------------------------------------------------ constructor / destructor

  constructor(callback) {
    this._shortcuts = new Map();

    this._displayConnection =
        global.display.connect('accelerator-activated', (display, action) => {
          for (let it of this._shortcuts) {
            if (it[1].action == action) {
              callback(it[0]);
            }
          }
        });
  }

  destroy() {
    global.display.disconnect(this._displayConnection);

    for (let shortcut of this.getBound()) {
      this.unbind(shortcut);
    }
  }

  // -------------------------------------------------------------------- public interface

  bind(shortcut) {
    const action = global.display.grab_accelerator(shortcut, Meta.KeyBindingFlags.NONE);

    if (action == Meta.KeyBindingAction.NONE) {
      utils.debug('Unable to grab shortcut ' + shortcut + '!');
    } else {
      const name = Meta.external_binding_name_for_action(action);
      Main.wm.allowKeybinding(name, Shell.ActionMode.ALL);

      this._shortcuts.set(shortcut, {name: name, action: action});
    }
  }

  // Un-binds any previously bound callback.
  unbind(shortcut) {
    const it = this._shortcuts.get(shortcut);

    if (it) {
      global.display.ungrab_accelerator(it.action);
      Main.wm.allowKeybinding(it.name, Shell.ActionMode.NONE);
      this._shortcuts.delete(shortcut);
    }
  }

  isBound(shortcut) {
    return this._shortcuts.has(shortcut);
  }

  getBound() {
    return new Set(this._shortcuts.keys());
  }
};
