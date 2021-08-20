//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const {GObject, Gtk} = imports.gi;

const _ = imports.gettext.domain('flypie').gettext;

function registerWidget() {

  if (GObject.type_from_name('FlyPieCopyValueButton') == null) {
    // clang-format off
      GObject.registerClass({
        GTypeName: 'FlyPieCopyValueButton',
        Template: 'resource:///ui/copyValueButton.ui',
      }, class FlyPieCopyValueButton extends Gtk.Button {});
    // clang-format on
  }
}