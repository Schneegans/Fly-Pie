//////////////////////////////////////////////////////////////////////////////////////////
//                                                                                      //
//       ___                       __               This software may be modified       //
//      (_  `     o  _   _        )_) o  _          and distributed under the           //
//    .___) )_)_) ( ) ) (_(  --  /    ) (/_         terms of the MIT license. See       //
//                        _)                        the LICENSE file for details.       //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Main          = imports.ui.main;
const {Shell, Meta} = imports.gi;

//////////////////////////////////////////////////////////////////////////////////////////
// This class can be used to bind functions to global hot keys. The code is based on    //
// code by zzrough (https://github.com/zzrough/gs-extensions-drop-down-terminal)        //
//////////////////////////////////////////////////////////////////////////////////////////

var KeyBindings = class KeyBindings {

  // -------------------------------------------------------------------- public interface

  // Binds the given callback to the hotkey specified by the given settings key.
  // The settings parameter must be a Gio.Settings object.
  static bindShortcut(settings, key, func) {
    if (Main.wm.addKeybinding && Shell.ActionMode)  // introduced in 3.16
      Main.wm.addKeybinding(
          key, settings, Meta.KeyBindingFlags.NONE, Shell.ActionMode.NORMAL, func);
    else if (Main.wm.addKeybinding && Shell.KeyBindingMode)  // introduced in 3.7.5
      Main.wm.addKeybinding(
          key, settings, Meta.KeyBindingFlags.NONE, Shell.KeyBindingMode.NORMAL, func);
    else if (Main.wm.addKeybinding && Main.KeybindingMode)  // introduced in 3.7.2
      Main.wm.addKeybinding(
          key, settings, Meta.KeyBindingFlags.NONE, Main.KeybindingMode.NORMAL, func);
    else
      global.display.add_keybinding(key, settings, Meta.KeyBindingFlags.NONE, func);
  }

  // Un-binds any previously bound callback.
  static unbindShortcut(key) {
    if (Main.wm.removeKeybinding)  // introduced in 3.7.2
      Main.wm.removeKeybinding(key);
    else
      global.display.remove_keybinding(key);
  }
};
