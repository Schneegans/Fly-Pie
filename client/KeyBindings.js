//////////////////////////////////////////////////////////////////////////////////////////
//                                                                                      //
//    _____                    ___  _     ___       This software may be modified       //
//   / ___/__  ___  __ _  ___ / _ \(_)__ |_  |      and distributed under the           //
//  / (_ / _ \/ _ \/  ' \/ -_) ___/ / -_) __/       terms of the MIT license. See       //
//  \___/_//_/\___/_/_/_/\__/_/  /_/\__/____/       the LICENSE file for details.       //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Main  = imports.ui.main;
const Shell = imports.gi.Shell;
const Meta  = imports.gi.Meta;

//////////////////////////////////////////////////////////////////////////////////////////
// This class can be used to bind functions to global hot keys. The code is based on    //
// code by zzrough (https://github.com/zzrough/gs-extensions-drop-down-terminal)        //
//////////////////////////////////////////////////////////////////////////////////////////

var KeyBindings = class KeyBindings {

  // -------------------------------------------------------------------- public interface

  // Binds the given callback to the hotkey specified by the given settings key.
  // The settings parameter must be a Gio.Settings object.
  static bindShortcut(settings, key, func) {
    if (Main.wm.addKeybinding && Shell.ActionMode) // introduced in 3.16
      Main.wm.addKeybinding(
        key, settings, Meta.KeyBindingFlags.NONE, Shell.ActionMode.NORMAL, func);
    else if (Main.wm.addKeybinding && Shell.KeyBindingMode) // introduced in 3.7.5
      Main.wm.addKeybinding(
        key, settings, Meta.KeyBindingFlags.NONE, Shell.KeyBindingMode.NORMAL, func);
    else if (Main.wm.addKeybinding && Main.KeybindingMode) // introduced in 3.7.2
      Main.wm.addKeybinding(
        key, settings, Meta.KeyBindingFlags.NONE, Main.KeybindingMode.NORMAL, func);
    else
      global.display.add_keybinding(key, settings, Meta.KeyBindingFlags.NONE, func);
  }

  // Un-binds any previously bound callback.
  static unbindShortcut(key) {
    if (Main.wm.removeKeybinding) // introduced in 3.7.2
      Main.wm.removeKeybinding(key);
    else
      global.display.remove_keybinding(key);
  }
};
