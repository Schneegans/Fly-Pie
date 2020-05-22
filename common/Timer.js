//////////////////////////////////////////////////////////////////////////////////////////
//                                                                                      //
//    _____                    ___  _     ___       This software may be modified       //
//   / ___/__  ___  __ _  ___ / _ \(_)__ |_  |      and distributed under the           //
//  / (_ / _ \/ _ \/  ' \/ -_) ___/ / -_) __/       terms of the MIT license. See       //
//  \___/_//_/\___/_/_/_/\__/_/  /_/\__/____/       the LICENSE file for details.       //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = ExtensionUtils.getCurrentExtension();
const debug          = Me.imports.common.debug.debug;

//////////////////////////////////////////////////////////////////////////////////////////
// This can be used for some basic profiling by measuring roughly the time some parts   //
// of the code take.                                                                    //
//////////////////////////////////////////////////////////////////////////////////////////

var Timer = class Timer {

  // -------------------------------------------------------------------- public interface

  constructor() { this.reset(); }

  // Returns the time in milliseconds since the last time reset() was called.
  getElapsed() { return Date.now() - this._now; }

  // Stores the current date for future getElapsed() calls.
  reset() { this._now = Date.now(); }

  // Prints the given message together with the time since the last call to reset() or
  // printElapsedAndReset().
  printElapsedAndReset(message) {
    debug(message + ": " + this.getElapsed() + " ms");
    this.reset();
  }
};
