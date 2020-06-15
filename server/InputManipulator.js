//////////////////////////////////////////////////////////////////////////////////////////
//                                                                                      //
//       ___                       __               This software may be modified       //
//      (_  `     o  _   _        )_) o  _          and distributed under the           //
//    .___) )_)_) ( ) ) (_(  --  /    ) (/_         terms of the MIT license. See       //
//                        _)                        the LICENSE file for details.       //
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
