//////////////////////////////////////////////////////////////////////////////////////////
//   _____       _             _____ _                                                  //
//  |   __|_ _ _|_|___ ___ ___|  _  |_|___   This software may be modified and distri-  //
//  |__   | | | | |   | . |___|   __| | -_|  buted under the terms of the MIT license.  //
//  |_____|_____|_|_|_|_  |   |__|  |_|___|  See the LICENSE file for details.          //
//                    |___|                                                             //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Me    = imports.misc.extensionUtils.getCurrentExtension();
const utils = Me.imports.common.utils;

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
