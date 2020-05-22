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
//////////////////////////////////////////////////////////////////////////////////////////

var Timer = class Timer {

  // -------------------------------------------------------------------- public interface
  constructor() { this.reset(); }

  getElapsed() { return Date.now() - this._now; }

  reset() { this._now = Date.now(); }

  printElapsedAndReset(message) {
    debug(message + ": " + this.getElapsed() + " ms");
    this.reset();
  }
};
