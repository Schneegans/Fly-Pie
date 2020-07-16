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

// Like in 'extension.js' this is used for any one-time setup like translations.
function init() {}

// This function is called when the preferences window is created to build and return a
// Gtk widget. We create a new instance of the settings class each time this method is
// called. This way we can actually open multiple settings windows and interact with all
// of the properly.
function buildPrefsWidget() {
  let settings = new Settings();
  return settings.getWidget();
}
