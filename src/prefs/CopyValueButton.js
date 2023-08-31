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

import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

//////////////////////////////////////////////////////////////////////////////////////////
// The CopyValueButton is instantiated many times in Fly-Pie's settings dialog. It is   //
// a simple circular button with an arrow which is used to copy values from its left to //
// its right side.                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

export function registerWidget() {
  if (GObject.type_from_name('FlyPieCopyValueButton') == null) {
    // clang-format off
      GObject.registerClass({
        GTypeName: 'FlyPieCopyValueButton',
        Template: `resource:///ui/gtk4/copyValueButton.ui`,
      }, class FlyPieCopyValueButton extends Gtk.Button {});
    // clang-format on
  }
}