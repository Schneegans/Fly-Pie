//////////////////////////////////////////////////////////////////////////////////////////
//                                                                                      //
//    _____                    ___  _     ___       This software may be modified       //
//   / ___/__  ___  __ _  ___ / _ \(_)__ |_  |      and distributed under the           //
//  / (_ / _ \/ _ \/  ' \/ -_) ___/ / -_) __/       terms of the MIT license. See       //
//  \___/_//_/\___/_/_/_/\__/_/  /_/\__/____/       the LICENSE file for details.       //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Clutter = imports.gi.Clutter;

const Me = imports.misc.extensionUtils.getCurrentExtension();

var InputManipulator = class InputManipulator {
  constructor() {
    const seat = Clutter.get_default_backend().get_default_seat();
    this._virtualTouchpad =
        seat.create_virtual_device(Clutter.InputDeviceType.POINTER_DEVICE);
  }

  warpPointer(x, y) {
    const currentTime = global.get_current_time();
    this._virtualTouchpad.notify_absolute_motion(currentTime, x, y);
  }
};
