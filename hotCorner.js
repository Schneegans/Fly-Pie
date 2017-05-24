/////////////////////////////////////////////////////////////////////////////////////////
//                                                                                     //
//    _____                    ___  _     ___       This software may be modified      //
//   / ___/__  ___  __ _  ___ / _ \(_)__ |_  |      and distributed under the          //
//  / (_ / _ \/ _ \/  ' \/ -_) ___/ / -_) __/       terms of the MIT license. See      //
//  \___/_//_/\___/_/_/_/\__/_/  /_/\__/____/       the LICENSE file for details.      //
//                                                                                     //
//  Authors: Simon Schneegans (code@simonschneegans.de)                                //
//                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////

const Main = imports.ui.main;
const Lang = imports.lang;

// based on code by azuri (https://github.com/HROMANO/nohotcorner/), thank you!

const HotCorner = new Lang.Class({
  Name : 'HotCorner',

  disable : function() {
    this._disable_hot_corners();
    this.id = Main.layoutManager.connect('hot-corners-changed', 
                                         this._disable_hot_corners);
  },

  enable : function() {
    // Disconnects the callback and re-creates the hot corners
    Main.layoutManager.disconnect(this.id);
    Main.layoutManager._updateHotCorners();
  },

  _disable_hot_corners : function() {
    // Disables all hot corners
    Main.layoutManager.hotCorners.forEach(function(hot_corner) {
      if (!hot_corner) {
        return;
      }

      hot_corner._toggleOverview = function() {};
      hot_corner._pressureBarrier._trigger = function() {};
    });
  }
});
