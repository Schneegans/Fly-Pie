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
const utils = Me.imports.common.utils;

//////////////////////////////////////////////////////////////////////////////////////////
// The static statistics class is used to record some statistics of Fly-Pie. These      //
// statistics can be seen in Fly-Pie's settings dialog and are used as a basis for the  //
// achievements. The statistics are stored in the stats-* keys of Fly-Pie's             //
// Gio.Settings.                                                                        //
//////////////////////////////////////////////////////////////////////////////////////////

// This global variable will store the Gio.Settings we're working with.
let _settings = null;

var Statistics = class Statistics {

  // ---------------------------------------------------------------------- static methods

  // This should be called whenever a successful selection is made.
  static addSelection(depth, time, gestureOnlySelection) {
    this._initSettings();

    // We add the selection to one of the histograms with selection counts per selection
    // time. There is one of these histograms for the first four selection depths for
    // either point-and-click selections or for gesture selections.
    const key =
        gestureOnlySelection ? 'stats-gesture-selections' : 'stats-click-selections';

    // Retrieve all histograms from the settings and make sure that we have four of them.
    // Any selection deeper than five will be recorded in the fourth bin.
    const histograms = _settings.get_value(key).deep_unpack();
    this._resizeArray(histograms, 4, []);

    // We limit our histogram to selections which took five seconds. The bin size is set
    // to 200 milliseconds.
    const upperBound = 5000;
    const binSize    = 200;
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
    _settings.set_value(key, new GLib.Variant('aau', histograms));
  }

  // Should be called whenever a selection is canceled.
  static addAbortion() {
    this._addOneTo('stats-abortions');
  }

  // Should be called whenever a custom menu is opened via the D-Bus interface.
  static addCustomDBusMenu() {
    this._addOneTo('stats-dbus-menus');
  }

  // Should be called whenever the settings dialog is opened.
  static addSettingsOpened() {
    this._addOneTo('stats-settings-opened');
  }

  // This should be called when the Fly-Pie extension is disabled. It deletes the
  // Gio.Settings object.
  static cleanUp() {
    _settings = null;
  }

  // ----------------------------------------------------------------------- private stuff

  // Create the Gio.Settings object lazily.
  static _initSettings() {
    if (_settings == null) {
      _settings = utils.createSettings();
    }
  }

  // Increases the value of the given settings key by one.
  static _addOneTo(key) {
    this._initSettings();
    _settings.set_uint(key, _settings.get_uint(key) + 1);
  }

  // Helper method to resize the given JavaScript array to the given size. If the input
  // array is larger, it will be truncated, if it's smaller, it will be back-padded with
  // copies of defaultValue.
  static _resizeArray(array, size, defaultValue) {

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