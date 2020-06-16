//////////////////////////////////////////////////////////////////////////////////////////
//   _____       _             _____ _                                                  //
//  |   __|_ _ _|_|___ ___ ___|  _  |_|___   This software may be modified and distri-  //
//  |__   | | | | |   | . |___|   __| | -_|  buted under the terms of the MIT license.  //
//  |_____|_____|_|_|_|_  |   |__|  |_|___|  See the LICENSE file for details.          //
//                    |___|                                                             //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Me       = imports.misc.extensionUtils.getCurrentExtension();
const Settings = Me.imports.settings.Settings.Settings;

// ------------------------------------------------------------------------ global methods

// Like 'extension.js' this is used for any one-time setup like translations.
function init() {}

// This function is called when the preferences window is created to build and return a
// Gtk widget.
function buildPrefsWidget() {
  let settings = new Settings();
  return settings.getWidget();
}
