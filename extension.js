//////////////////////////////////////////////////////////////////////////////////////////
//   _____       _             _____ _                                                  //
//  |   __|_ _ _|_|___ ___ ___|  _  |_|___   This software may be modified and distri-  //
//  |__   | | | | |   | . |___|   __| | -_|  buted under the terms of the MIT license.  //
//  |_____|_____|_|_|_|_  |   |__|  |_|___|  See the LICENSE file for details.          //
//                    |___|                                                             //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Me     = imports.misc.extensionUtils.getCurrentExtension();
const Daemon = Me.imports.daemon.Daemon.Daemon;

//////////////////////////////////////////////////////////////////////////////////////////
// Once enabled, Swing-Pie creates an instance of the Daemon class. This daemon will    //
// show a pie menu when it receives a show-menu request on the D-Bus or when one of     //
// the configured shortcuts are pressed.                                                //
//                                                                                      //
// This extension consists of three main source code directories:                       //
//   daemon/     This contains code which is only required by extension.js.             //
//   settings/   This contains code which is only required by prefs.js.                 //
//   common/     This contains code which is required by extension.js and prefs.js.     //
//////////////////////////////////////////////////////////////////////////////////////////

let daemon;

// This function is called once when the extension is loaded, not enabled. Nothing to be
// done here for Swing-Pie.
function init() {}

// This function could be called after the extension is enabled, which could be done from
// GNOME Tweaks, when you log in or when the screen is unlocked. We create an instance of
// the Daemon class.
function enable() {
  daemon = new Daemon();
}

// This function could be called after the extension is uninstalled, disabled in GNOME
// Tweaks, when you log out or when the screen locks. It deletes the previously created
// damon.
function disable() {
  daemon.destroy();
  daemon = null;
}
