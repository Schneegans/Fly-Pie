//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const {Clutter, Gdk, Gtk} = imports.gi;

const Me    = imports.misc.extensionUtils.getCurrentExtension();
const utils = Me.imports.common.utils;

//////////////////////////////////////////////////////////////////////////////////////////
// An instance of this class can be used to create faked input events. You can use it   //
// to move the mouse pointer or to press accelerator key strokes.                       //
//////////////////////////////////////////////////////////////////////////////////////////

var InputManipulator = class InputManipulator {

  // ------------------------------------------------------------ constructor / destructor

  constructor() {

    // get_default_seat() is available since GNOME Shell 3.36.
    if (Clutter.get_default_backend().get_default_seat) {
      const dev      = Clutter.get_default_backend().get_default_seat();
      this._mouse    = dev.create_virtual_device(Clutter.InputDeviceType.POINTER_DEVICE);
      this._keyboard = dev.create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);
    } else {
      const dev      = Clutter.DeviceManager.get_default();
      this._mouse    = dev.create_virtual_device(Clutter.InputDeviceType.POINTER_DEVICE);
      this._keyboard = dev.create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);
    }

    // We store the modifier button's keyvals for later access.
    this._shiftL = Gdk.keyval_from_name('Shift_L');
    this._shiftR = Gdk.keyval_from_name('Shift_R');
    this._ctrlL  = Gdk.keyval_from_name('Control_L');
    this._ctrlR  = Gdk.keyval_from_name('Control_R');
    this._altL   = Gdk.keyval_from_name('Alt_L');
    this._altR   = Gdk.keyval_from_name('Alt_R');
    this._superL = Gdk.keyval_from_name('Super_L');
    this._superR = Gdk.keyval_from_name('Super_R');
  }

  // -------------------------------------------------------------------- public interface

  // Warps the mouse pointer to the specified position.
  warpPointer(x, y) {
    this._mouse.notify_absolute_motion(global.get_current_time(), x, y);
  }

  // Simulates the activation of a given accelerator. The string can be anything accepted
  // by Gtk.accelerator_parse(). That is, for example, "<Control>a" or "<Shift><Alt>F1".
  activateAccelerator(string) {

    // First we release any currently pressed modifiers.
    const currentMods = global.get_pointer()[2];
    this._releaseModifiers(currentMods);

    // Now parse the string and press the buttons accordingly.
    const [keyval, mods] = Gtk.accelerator_parse(string);
    this._pressModifiers(mods);
    this._keyboard.notify_keyval(
        global.get_current_time(), keyval, Clutter.KeyState.PRESSED);
    this._keyboard.notify_keyval(
        global.get_current_time(), keyval, Clutter.KeyState.RELEASED);
    this._releaseModifiers(mods);

    // Finally we re-press the modifiers which were pressed before.
    this._pressModifiers(currentMods);
  }

  // ----------------------------------------------------------------------- private stuff

  // Helper method which 'releases' the desired modifier keys.
  _releaseModifiers(modifiers) {
    const state = Clutter.KeyState.RELEASED;

    // Since we do not know whether left or right version of each key is pressed, we
    // release both...
    if (modifiers & Gdk.ModifierType.CONTROL_MASK) {
      this._keyboard.notify_keyval(global.get_current_time(), this._ctrlL, state);
      this._keyboard.notify_keyval(global.get_current_time(), this._ctrlR, state);
    }

    if (modifiers & Gdk.ModifierType.SHIFT_MASK) {
      this._keyboard.notify_keyval(global.get_current_time(), this._shiftL, state);
      this._keyboard.notify_keyval(global.get_current_time(), this._shiftR, state);
    }

    if (modifiers & Gdk.ModifierType.MOD1_MASK) {
      this._keyboard.notify_keyval(global.get_current_time(), this._altL, state);
      this._keyboard.notify_keyval(global.get_current_time(), this._altR, state);
    }

    if (modifiers & Gdk.ModifierType.SUPER_MASK) {
      this._keyboard.notify_keyval(global.get_current_time(), this._superL, state);
      this._keyboard.notify_keyval(global.get_current_time(), this._superR, state);
    }
  }

  // Helper method which 'presses' the desired modifier keys.
  _pressModifiers(modifiers) {
    const state = Clutter.KeyState.PRESSED;

    if (modifiers & Gdk.ModifierType.CONTROL_MASK) {
      this._keyboard.notify_keyval(global.get_current_time(), this._ctrlL, state);
    }

    if (modifiers & Gdk.ModifierType.SHIFT_MASK) {
      this._keyboard.notify_keyval(global.get_current_time(), this._shiftL, state);
    }

    if (modifiers & Gdk.ModifierType.MOD1_MASK) {
      this._keyboard.notify_keyval(global.get_current_time(), this._altL, state);
    }

    if (modifiers & Gdk.ModifierType.SUPER_MASK) {
      this._keyboard.notify_keyval(global.get_current_time(), this._superL, state);
    }
  }
};
