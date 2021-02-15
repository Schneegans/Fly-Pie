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
// The static statistics class is used to record some statistics of Fly-Pie. These      //
// statistics can be seen in Fly-Pie's settings dialog and are used as a basis for the  //
// achievements. The statistics are stored in the stats-* keys of Fly-Pie's             //
// Gio.Settings.                                                                        //
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
    // noticeable stutter in Fly-Pie's animations. Applying the seconds with one second
    // delay makes it much more unlikely that an animation is currently in progress.
    this._settings = utils.createSettings();
    this._settings.delay();

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

    // We add the selection to one of the histograms with selection counts per selection
    // time. There is one of these histograms for the first four selection depths for
    // either point-and-click selections or for gesture selections.
    const key =
        gestureOnlySelection ? 'stats-gesture-selections' : 'stats-click-selections';

    // Retrieve all histograms from the settings and make sure that we have four of them.
    // Any selection deeper than five will be recorded in the fourth bin.
    const histograms = this._settings.get_value(key).deep_unpack();
    this._resizeArray(histograms, 4, []);

    // We limit our histogram to selections which took ten seconds. The bin size is set
    // to 200 milliseconds.
    const upperBound = 10000;
    const binSize    = 250;
    const bins       = upperBound / binSize;

    // Then initialize each histogram to the correct bin size.
    for (let i = 0; i < histograms.length; i++) {
      this._resizeArray(histograms[i], bins, 0);
    }

    // Now select the histogram for the current depth and increase the bin for the given
    // selection time.
    const histogram = histograms[depth - 1];
    const bin       = Math.floor(Math.min(Math.max(0, time / binSize), bins - 1));
    ++histogram[bin];

    // Finally update the updated histograms.
    const data = new GLib.Variant('aau', histograms);
    this._settings.set_value(key, data);
    this._save();
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
  // Fly-Pie's animations. Applying the seconds with one second delay makes it much more
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

  // Helper method to resize the given JavaScript array to the given size. If the input
  // array is larger, it will be truncated, if it's smaller, it will be back-padded with
  // copies of defaultValue.
  _resizeArray(array, size, defaultValue) {

    // Make sure we have actually an array.
    if (!Array.isArray(array)) {
      array = [];
    }

    // Extent if needed.
    while (array.length < size) {
      // Create a copy of defaultValue if it's not a primitive type.
      typeof (defaultValue) === 'object' ? array.push(Object.create(defaultValue)) :
                                           array.push(defaultValue);
    }

    // Truncate if needed.
    array.length = size;
  }
}