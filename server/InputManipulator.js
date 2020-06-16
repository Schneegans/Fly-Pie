//////////////////////////////////////////////////////////////////////////////////////////
//   _____       _             _____ _                                                  //
//  |   __|_ _ _|_|___ ___ ___|  _  |_|___   This software may be modified and distri-  //
//  |__   | | | | |   | . |___|   __| | -_|  buted under the terms of the MIT license.  //
//  |_____|_____|_|_|_|_  |   |__|  |_|___|  See the LICENSE file for details.          //
//                    |___|                                                             //
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
