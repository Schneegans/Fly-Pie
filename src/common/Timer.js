//////////////////////////////////////////////////////////////////////////////////////////
//                               ___            _     ___                               //
//                               |   |   \/    | ) |  |                                 //
//                           O-  |-  |   |  -  |   |  |-  -O                            //
//                               |   |_  |     |   |  |_                                //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

// SPDX-FileCopyrightText: Simon Schneegans <code@simonschneegans.de>
// SPDX-License-Identifier: MIT

'use strict';

import * as utils from './utils.js';

//////////////////////////////////////////////////////////////////////////////////////////
// This can be used for some basic profiling by measuring roughly the time some parts   //
// of the code take.                                                                    //
//////////////////////////////////////////////////////////////////////////////////////////

export default class Timer {

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
