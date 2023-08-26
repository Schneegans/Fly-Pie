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

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import Daemon from './src/extension/Daemon.js';

//////////////////////////////////////////////////////////////////////////////////////////
// Once enabled, Fly-Pie creates an instance of the Daemon class. This daemon will      //
// show a pie menu when it receives a show-menu request on the D-Bus or when one of     //
// the configured shortcuts are pressed.                                                //
//                                                                                      //
// This extension consists of three main source code directories:                       //
//   daemon/     This contains code which is only required by extension.js.             //
//   settings/   This contains code which is only required by prefs.js.                 //
//   common/     This contains code which is required by extension.js and prefs.js.     //
//////////////////////////////////////////////////////////////////////////////////////////

export default class FlyPie extends Extension {

  // This function could be called after the extension is enabled, which could be done
  // from GNOME Tweaks, when you log in or when the screen is unlocked. We create an
  // instance of the Daemon class.
  enable() {
    this.daemon = new Daemon(this.metadata);
  }

  // This function could be called after the extension is uninstalled, disabled in GNOME
  // Tweaks, when you log out or when the screen locks. It deletes the previously created
  // damon.
  disable() {
    this.daemon.destroy();
    this.daemon = null;
  }
}
