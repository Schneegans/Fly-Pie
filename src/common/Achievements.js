//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const {GLib, Gio} = imports.gi;

// We have to import the Main module optionally. This is because this file is included
// from both sides: From prefs.js and from extension.js. When included from prefs.js, the
// Main module is not available. This is not a problem, as the preferences will not call
// the notify() method below.
let Main = undefined;

try {
  Main = imports.ui.main;
} catch (error) {
  // Nothing to be done, we're in settings-mode.
}

const Me    = imports.misc.extensionUtils.getCurrentExtension();
const utils = Me.imports.src.common.utils;

//////////////////////////////////////////////////////////////////////////////////////////
// The static achievements class is used to record some statistics of Fly-Pie. The      //
// achievements can be seen in Fly-Pie's settings dialog. The statistics are stored in  //
// the stats-* keys of Fly-Pie's Gio.Settings.                                          //
//////////////////////////////////////////////////////////////////////////////////////////

// This class is supposed to be used as singleton in order to prevent frequent
// constructions and deconstructions of the contained Gio.Settings object. This global
// variable stores the singleton instance.
let _instance = null;

var Achievements = class Achievements {

  // ---------------------------------------------------------------------- static methods

  // Create the singleton instance lazily.
  static getInstance() {
    if (_instance == null) {
      _instance = new Achievements();
    }

    return _instance;
  }

  // This should be called when the Fly-Pie extension is disabled or the preferences
  // dialog is closed. It deletes the Gio.Settings object.
  static destroyInstance() {
    if (_instance != null) {
      _instance.destroy();
      _instance = null;
    }
  }
  // ------------------------------------------------------------ constructor / destructor

  // This should not be called directly. Use the static singleton interface above!
  constructor() {

    // Create the settings object in "delayed" mode. Delayed mode was chosen because the
    // apply() can take up to 100~ms on some systems I have tested. This results in a
    // noticeable stutter in Fly-Pie's animations. Applying the seconds with one second
    // delay makes it much more unlikely that an animation is currently in progress.
    this._settings = utils.createSettings();

    // We keep several connections to the Gio.Settings object. Once the settings dialog is
    // closed, we use this array to disconnect all of them.
    this._settingsConnections = [];

    // If the click-selections statistics key changes (that means that the user selected
    // something by point-and-click), check for newly unlocked achievements.
    this._settingsConnections.push(
        this._settings.connect('changed::stats-abortions', () => {
          this._notify(
              'Level up!', 'You just reached level 10!',
              Gio.icon_new_for_string(Me.path + '/assets/badges/levels/level10.png'));
        }));

    this._saveTimeout = -1;

    this._settings.delay();
  }


  // This should not be called directly. Use the static singleton interface above!
  destroy() {

    // Save the settings if required.
    if (this._saveTimeout >= 0) {
      GLib.source_remove(this._saveTimeout);
      this._settings.apply();
    }

    this._settingsConnections.forEach(connection => {
      this._settings.disconnect(connection);
    });

    this._settings = null;
  }

  // -------------------------------------------------------------------- public interface

  // This should be called whenever a successful selection is made.
  addSelection(depth, time, gestureOnlySelection) {}

  // Should be called whenever a selection is canceled.
  addAbortion() {
    this._addOneTo('stats-abortions');
  }

  // Should be called whenever a custom menu is opened via the D-Bus interface.
  addCustomDBusMenu() {
    this._addOneTo('stats-dbus-menus');
  }

  // Should be called whenever the settings dialog is opened.
  addSettingsOpened() {
    this._addOneTo('stats-settings-opened');
  }

  // Should be called whenever a preset is saved.
  addPresetSaved() {
    this._addOneTo('stats-presets-saved');
  }

  // Should be called whenever a menu configuration is imported.
  addMenuImport() {
    this._addOneTo('stats-menus-imported');
  }

  // Should be called whenever a menu configuration is exported.
  addMenuExport() {
    this._addOneTo('stats-menus-exported');
  }

  // Should be called whenever a random preset is generated.
  addRandomPreset() {
    this._addOneTo('stats-random-presets');
  }

  // ----------------------------------------------------------------------- private stuff

  // Our Gio.Settings object is in "delayed" mode so we have to manually call apply()
  // whenever a property is changed. Delayed mode was chosen because the apply() can take
  // up to 100~ms on some systems I have tested. This results in a noticeable stutter in
  // Fly-Pie's animations. Applying the settings with one second delay makes it much more
  // unlikely that an animation is currently in progress.
  _save() {
    if (this._saveTimeout >= 0) {
      GLib.source_remove(this._saveTimeout);
    }

    this._saveTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
      this._settings.apply();
      this._saveTimeout = -1;
    });
  }

  // Increases the value of the given settings key by one.
  _addOneTo(key) {
    this._settings.set_uint(key, this._settings.get_uint(key) + 1);
    this._save();
  }

  // Shows a GNOME Shell notification with the given label, description and icon. The size
  // of the icon seems to depend on the currently used theme and cannot be set from here.
  // The notification will also contain a hard-coded button which opens the achievements
  // page of the settings dialog. This cannot be used from the preferences dialog.
  _notify(label, details, gicon) {
    const source = new Main.MessageTray.Source('Fly-Pie', '');
    Main.messageTray.add(source);

    const n = new Main.MessageTray.Notification(source, label, details, {gicon: gicon});

    // Translators: This is shown on the action button of the notification bubble which is
    // shown once an achievement is unlocked.
    n.addAction(_('Show Achievements'), () => {
      // Make sure the achievements page is shown.
      this._settings.set_string('active-stack-child', 'achievements-page');

      if (this._saveTimeout >= 0) {
        GLib.source_remove(this._saveTimeout);
      }

      this._settings.apply();

      // Show the settings dialog.
      Main.extensionManager.openExtensionPrefs(Me.uuid, '');
    });

    source.showNotification(n);
  }
}