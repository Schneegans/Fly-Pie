//////////////////////////////////////////////////////////////////////////////////////////
//                                                                                      //
//    _____                    ___  _     ___       This software may be modified       //
//   / ___/__  ___  __ _  ___ / _ \(_)__ |_  |      and distributed under the           //
//  / (_ / _ \/ _ \/  ' \/ -_) ___/ / -_) __/       terms of the MIT license. See       //
//  \___/_//_/\___/_/_/_/\__/_/  /_/\__/____/       the LICENSE file for details.       //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const GLib = imports.gi.GLib;
const Gio  = imports.gi.Gio;
const Gdk  = imports.gi.Gdk;
const Gtk  = imports.gi.Gtk;

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = ExtensionUtils.getCurrentExtension();
const debug          = Me.imports.common.debug;

let widgetSignalHandlers = {};
let settings             = null;
let builder              = null;

// Like 'extension.js' this is used for any one-time setup like translations.
function init() {}

// This function is called when the preferences window is first created to build
// and return a Gtk widget.
function buildPrefsWidget() {
  let schema = Gio.SettingsSchemaSource.new_from_directory(
      Me.dir.get_child('schemas').get_path(), Gio.SettingsSchemaSource.get_default(),
      false);

  settings = new Gio.Settings(
      {settings_schema: schema.lookup('org.gnome.shell.extensions.gnomepie2', true)});

  builder = new Gtk.Builder();
  builder.add_from_file(Me.path + '/prefs.ui');
  builder.connect_signals_full((builder, object, signal, handler) => {
    object.connect(signal, (...args) => widgetSignalHandlers[handler](...args));
  });

  _bindSlider('global-scale');
  _bindSlider('center-size');
  _bindSlider('center-icon-scale');
  _bindSlider('child-size');
  _bindSlider('child-offset');
  _bindSlider('child-icon-scale');
  _bindSlider('grandchild-size');
  _bindSlider('grandchild-offset');

  _bindColorButton('background-color');
  _bindColorButton('menu-color');
  _bindColorButton('text-color');

  return builder.get_object('main-notebook');
}

function _bindResetButton(settingsKey) {
  let resetButton = builder.get_object('reset-' + settingsKey);
  if (resetButton) {
    resetButton.connect('clicked', () => settings.reset(settingsKey));
  }
}

function _bindSlider(settingsKey) {
  settings.bind(
      settingsKey, builder.get_object(settingsKey), 'value',
      Gio.SettingsBindFlags.DEFAULT);

  _bindResetButton(settingsKey);
}

// Gio.Settings.bind_with_mapping is not available yet, so we need to do the color
// conversion like this.
function _bindColorButton(settingsKey) {
  let colorChooser = builder.get_object(settingsKey);

  widgetSignalHandlers[settingsKey + '-changed'] = () => settings.set_value(
      settingsKey, new GLib.Variant('s', colorChooser.get_rgba().to_string()));

  let settingSignalHandler = () => {
    let rgba = new Gdk.RGBA();
    rgba.parse(settings.get_string(settingsKey));
    colorChooser.rgba = rgba;
  };

  settings.connect('changed::' + settingsKey, settingSignalHandler);

  settingSignalHandler();

  _bindResetButton(settingsKey);
}