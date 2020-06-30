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

//////////////////////////////////////////////////////////////////////////////////////////
// This class can be used to bind functions to global hot keys.                         //
//////////////////////////////////////////////////////////////////////////////////////////

var KeyBindings = class KeyBindings {

  // -------------------------------------------------------------------- public interface

  // Binds the given callback to the hotkey specified by the given settings key.
  // The settings parameter must be a Gio.Settings object.
  static bindShortcut(settings, key, func) {
    Main.wm.addKeybinding(
        key, settings, Meta.KeyBindingFlags.NONE, Shell.ActionMode.NORMAL, func);
  }

  // Un-binds any previously bound callback.
  static unbindShortcut(key) {
    Main.wm.removeKeybinding(key);
  }
};
