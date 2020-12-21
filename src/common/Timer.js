//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Me    = imports.misc.extensionUtils.getCurrentExtension();
const utils = Me.imports.src.common.utils;

//////////////////////////////////////////////////////////////////////////////////////////
// This can be used for some basic profiling by measuring roughly the time some parts   //
// of the code take.                                                                    //
//////////////////////////////////////////////////////////////////////////////////////////

var Timer = class Timer {

  // -------------------------------------------------------------------- public interface

  constructor() {
    this.reset();
  }

  // Returns the time in milliseconds since the last time reset() was called.
  getElapsed() {
    return Date.now() - this._now;
  }

  // Stores the current date for future getElapsed() calls.
  reset() {
    this._now = Date.now();
  }

  // Prints the given message together with the time since the last call to reset() or
  // printElapsedAndReset().
  printElapsedAndReset(message) {
    utils.debug(message + ': ' + this.getElapsed() + ' ms');
    this.reset();
  }
};
