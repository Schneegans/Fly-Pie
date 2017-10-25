//////////////////////////////////////////////////////////////////////////////////////////
//                                                                                      //
//    _____                    ___  _     ___       This software may be modified       //
//   / ___/__  ___  __ _  ___ / _ \(_)__ |_  |      and distributed under the           //
//  / (_ / _ \/ _ \/  ' \/ -_) ___/ / -_) __/       terms of the MIT license. See       //
//  \___/_//_/\___/_/_/_/\__/_/  /_/\__/____/       the LICENSE file for details.       //
//                                                                                      //
//  Authors: Simon Schneegans (code@simonschneegans.de)                                 //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

const Lang           = imports.lang;
const ExtensionUtils = imports.misc.extensionUtils;

const Me    = ExtensionUtils.getCurrentExtension();
const debug = Me.imports.debug.debug;

//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////

const Timer = new Lang.Class({
  Name : 'Timer',

  // -------------------------------------------------------------------- public interface
  _init : function() {
    this.reset();
  },

  getElapsed : function() {
    return Date.now() - this._now;
  },

  reset : function() {
    this._now = Date.now();
  },

  printElapsedAndReset : function(message) {
    debug(message + ": " + this.getElapsed() + " ms");
    this.reset();
  }
});
