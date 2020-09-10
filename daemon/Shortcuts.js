//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Main          = imports.ui.main;
const {Shell, Meta} = imports.gi;

const Me    = imports.misc.extensionUtils.getCurrentExtension();
const utils = Me.imports.common.utils;

//////////////////////////////////////////////////////////////////////////////////////////
// This class can be used to bind a function to global hot keys. It's designed in the   //
// following way: A callback is passed to the constructor of the class. Then, an        //
// arbitrary number of shortcuts can be bound. If one of the shortcuts is pressed, the  //
// callback will be executed. The pressed shortcut is passed as a parameter to the      //
// callback.                                                                            //
//////////////////////////////////////////////////////////////////////////////////////////

var Shortcuts = class Shortcuts {

  // ------------------------------------------------------------ constructor / destructor

  // Whenever one of the registered shortcuts is pressed, the given callback will be
  // executed. The pressed shortcut is given as parameter.
  constructor(callback) {

    // All registered callbacks are stored in this map.
    this._shortcuts = new Map();

    // Listen for global shortcut activations and execute the given callback if it's one
    // of ours.
    this._displayConnection =
        global.display.connect('accelerator-activated', (display, action) => {
          for (let it of this._shortcuts) {
            if (it[1].action == action) {
              callback(it[0]);
            }
          }
        });
  }

  // Unbinds all registered shortcuts.
  destroy() {
    global.display.disconnect(this._displayConnection);

    for (let shortcut of this.getBound()) {
      this.unbind(shortcut);
    }
  }

  // -------------------------------------------------------------------- public interface

  // Binds the given shortcut. When it's pressed, the callback given to this class
  // instance at construction time will be executed.
  bind(shortcut) {

    let action;
    const shellMinorVersion = parseInt(Config.PACKAGE_VERSION.split('.')[1]);

    if (shellMinorVersion <= 34) {
      action = global.display.grab_accelerator(shortcut);
    } else {
      action = global.display.grab_accelerator(shortcut, Meta.KeyBindingFlags.NONE);
    }

    if (action == Meta.KeyBindingAction.NONE) {
      utils.debug('Unable to grab shortcut ' + shortcut + '!');
    } else {
      const name = Meta.external_binding_name_for_action(action);
      Main.wm.allowKeybinding(name, Shell.ActionMode.ALL);

      this._shortcuts.set(shortcut, {name: name, action: action});
    }
  }

  // Un-binds any previously bound shortcut.
  unbind(shortcut) {
    const it = this._shortcuts.get(shortcut);

    if (it) {
      global.display.ungrab_accelerator(it.action);
      Main.wm.allowKeybinding(it.name, Shell.ActionMode.NONE);
      this._shortcuts.delete(shortcut);
    }
  }

  // Checks whether the given shortcut is currently bound by this Shortcuts instance.
  isBound(shortcut) {
    return this._shortcuts.has(shortcut);
  }

  // Returns a Set containing all shortcuts currently bound by this Shortcuts instance.
  getBound() {
    return new Set(this._shortcuts.keys());
  }
};
