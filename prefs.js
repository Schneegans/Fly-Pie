//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = imports.misc.extensionUtils.getCurrentExtension();
const Settings       = Me.imports.src.settings.Settings.Settings;

// Like in 'extension.js' this is used for setting up the translations.
function init() {
  ExtensionUtils.initTranslations();
}

// This function is called when the preferences window is created to build and return a
// Gtk widget. We create a new instance of the settings class each time this method is
// called. This way we can actually open multiple settings windows and interact with all
// of the properly.
function buildPrefsWidget() {
  let settings = new Settings();
  return settings.getWidget();
}
