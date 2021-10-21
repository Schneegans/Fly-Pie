//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const GLib = imports.gi.GLib;

const Me    = imports.misc.extensionUtils.getCurrentExtension();
const utils = Me.imports.src.common.utils;

//////////////////////////////////////////////////////////////////////////////////////////
// The Statistics singleton is used to record some statistics of Fly-Pie which are      //
// the basis for the achievements. The achievements can be seen in Fly-Pie's settings   //
// dialog and are tracked by the Achievements class. The statistics are stored in the   //
// stats-* keys of Fly-Pie's Gio.Settings.                                              //
//////////////////////////////////////////////////////////////////////////////////////////

// This class is supposed to be used as singleton in order to prevent frequent
// constructions and deconstructions of the contained Gio.Settings object. This global
// variable stores the singleton instance.
let _instance = null;

var Statistics = class Statistics {

  // ---------------------------------------------------------------------- static methods

  // Create the singleton instance lazily.
  static getInstance() {
    if (_instance == null) {
      _instance = new Statistics();
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
    // noticeable stutter in Fly-Pie's animations. Applying the settings with half a
    // second delay makes it much more unlikely that an animation is currently in
    // progress.
    this._settings = utils.createSettings();
    this._settings.delay();

    // As the settings object is in delay-mode, we have to call its apply() method after
    // we did some modification. We use a timeout in order to wait a little for any
    // additional modifications.
    this._saveTimeout = -1;
  }


  // This should not be called directly. Use the static singleton interface above!
  destroy() {

    // Save the settings if required.
    if (this._saveTimeout >= 0) {
      GLib.source_remove(this._saveTimeout);
      this._settings.apply();
    }

    this._settings = null;
  }

  // -------------------------------------------------------------------- public interface

  // This should be called whenever a successful selection is made.
  addSelection(depth, time, gestureOnlySelection) {

    // This contains the total number of all successful selection.
    this._addOneTo('stats-selections');

    // For selections at depth 1, 2 & 3, we store the number of gesture / point-and-click
    // selections separately.
    if (depth <= 3) {
      if (gestureOnlySelection) {
        this._addOneTo(`stats-gesture-selections-depth${depth}`);
      } else {
        this._addOneTo(`stats-click-selections-depth${depth}`);
      }
    }

    // All the statistics below are only increased if the selection was fast enough.
    if (depth == 1) {
      if (time <= 150) this._addOneTo('stats-selections-150ms-depth1');
      if (time <= 250) this._addOneTo('stats-selections-250ms-depth1');
      if (time <= 500) this._addOneTo('stats-selections-500ms-depth1');
      if (time <= 750) this._addOneTo('stats-selections-750ms-depth1');
      if (time <= 1000) this._addOneTo('stats-selections-1000ms-depth1');
    } else if (depth == 2) {
      if (time <= 250) this._addOneTo('stats-selections-250ms-depth2');
      if (time <= 500) this._addOneTo('stats-selections-500ms-depth2');
      if (time <= 750) this._addOneTo('stats-selections-750ms-depth2');
      if (time <= 1000) this._addOneTo('stats-selections-1000ms-depth2');
      if (time <= 2000) this._addOneTo('stats-selections-2000ms-depth2');
    } else if (depth == 3) {
      if (time <= 500) this._addOneTo('stats-selections-500ms-depth3');
      if (time <= 750) this._addOneTo('stats-selections-750ms-depth3');
      if (time <= 1000) this._addOneTo('stats-selections-1000ms-depth3');
      if (time <= 2000) this._addOneTo('stats-selections-2000ms-depth3');
      if (time <= 3000) this._addOneTo('stats-selections-3000ms-depth3');
    }
  }

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

  // Should be called whenever a menu configuration is imported.
  addMenuImport() {
    this._addOneTo('stats-menus-imported');
  }

  // Should be called whenever a menu configuration is exported.
  addMenuExport() {
    this._addOneTo('stats-menus-exported');
  }

  // Should be called whenever a preset is imported.
  addPresetImport() {
    this._addOneTo('stats-presets-imported');
  }

  // Should be called whenever a preset is exported.
  addPresetExport() {
    this._addOneTo('stats-presets-exported');
  }

  // Should be called whenever a random preset is generated.
  addRandomPreset() {
    this._addOneTo('stats-random-presets');
  }

  // Should be called when all menus have been deleted.
  addDeletedAllMenus() {
    this._addOneTo('stats-deleted-all-menus');
  }

  // Should be called whenever the tutorial menu is opened.
  addTutorialMenuOpened() {
    this._addOneTo('stats-tutorial-menus');
  }

  // Should be called whenever a preview menu is opened.
  addPreviewMenuOpened() {
    this._addOneTo('stats-preview-menus');
  }

  // Should be called whenever an item is added in the menu editor.
  addItemCreated() {
    this._addOneTo('stats-added-items');
  }

  // Should be called whenever the sponsors list is shown.
  addSponsorsViewed() {
    this._addOneTo('stats-sponsors-viewed');
  }

  // For historical reasons, all settings of Fly-Pie are included in one schema, including
  // the statistics keys. This is a bit unfortunate, as we cannot easily listen only for
  // appearance changes. This method can be used to check whether a given quark
  // corresponds to a statistics key.
  isStatsKey(quark) {
    const keys = this._settings.settings_schema.list_keys();
    for (let i = 0; i < keys.length; i++) {
      if (keys[i].startsWith('stats-')) {
        if (quark == GLib.quark_try_string(keys[i]) && quark != 0) {
          return true;
        }
      }
    };

    return false;
  }

  // This uses the method above to check whether the given list of quarks contains any
  // non-statistics key.
  containsAnyNonStatsKey(quarkList) {
    for (let i = 0; i < quarkList.length; i++) {
      if (!this.isStatsKey(quarkList[i])) {
        return true;
      }
    }

    return false;
  }

  // ----------------------------------------------------------------------- private stuff

  // Our Gio.Settings object is in "delayed" mode so we have to manually call apply()
  // whenever a property is changed. Delayed mode was chosen because the apply() can take
  // up to 100~ms on some systems I have tested. This results in a noticeable stutter in
  // Fly-Pie's animations. Applying the settings with half a second delay makes it much
  // more unlikely that an animation is currently in progress.
  _save() {

    // Cancel any previous _save() calls.
    if (this._saveTimeout >= 0) {
      GLib.source_remove(this._saveTimeout);
    }

    // Queue up a new apply().
    this._saveTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
      this._settings.apply();
      this._saveTimeout = -1;
    });
  }

  // Increases the value of the given settings key by one.
  _addOneTo(key) {
    this._settings.set_uint(key, this._settings.get_uint(key) + 1);
    this._save();
  }
}
