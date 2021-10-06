//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const {GObject, Gtk} = imports.gi;

const Me    = imports.misc.extensionUtils.getCurrentExtension();
const utils = Me.imports.src.common.utils;

//////////////////////////////////////////////////////////////////////////////////////////
// The CopyValueButton is instantiated many times in Fly-Pie's settings dialog. It is   //
// a simple circular button with an arrow which is used to copy values from its left to //
// its right side.                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

function registerWidget() {
  if (GObject.type_from_name('FlyPieCopyValueButton') == null) {
    // clang-format off
      GObject.registerClass({
        GTypeName: 'FlyPieCopyValueButton',
        Template: `resource:///ui/${utils.gtk4() ? "gtk4" : "gtk3"}/copyValueButton.ui`,
      }, class FlyPieCopyValueButton extends Gtk.Button {});
    // clang-format on
  }
}