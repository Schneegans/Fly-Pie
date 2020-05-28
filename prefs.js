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

const Me            = imports.misc.extensionUtils.getCurrentExtension();
const utils         = Me.imports.common.utils;
const DBusInterface = Me.imports.common.DBusInterface.DBusInterface;

const DBusWrapper = Gio.DBusProxy.makeProxyWrapper(DBusInterface.description);

let previewMenu = {
  name: 'Preview',
  icon: 'glade',
  items: [{name: 'Thunderbird', icon: 'thunderbird'}, {name: 'Firefox', icon: 'firefox'}]
}

let Settings = class Settings {
  constructor() {
    this._widgetSignalHandlers = {};
    this._builder              = null;
    this._settings             = utils.createSettings();

    this._builder = new Gtk.Builder();
    this._builder.add_from_file(Me.path + '/prefs.ui');
    this._builder.connect_signals_full((builder, object, signal, handler) => {
      object.connect(signal, (...args) => this._widgetSignalHandlers[handler](...args));
    });

    // Connect to the server so that we can toggle menus also from the preferences.
    new DBusWrapper(
        Gio.DBus.session, 'org.gnome.Shell', '/org/gnome/shell/extensions/gnomepie2',
        (proxy) => {
          this._dbus = proxy;
        });

    // Preview Button.
    let previewButton = this._builder.get_object('preview-button');
    previewButton.connect('clicked', () => {
      if (this._dbus) {
        this._dbus.EditMenuRemote(JSON.stringify(previewMenu), () => {});
      }
    });

    // General Settings.
    this._bindSlider('global-scale');
    this._bindColorButton('text-color');
    this._bindColorButton('background-color');
    this._bindSlider('auto-color-saturation');
    this._bindSlider('auto-color-brightness');

    // Center Item Settings.
    this._bindSwitch('center-auto-color');
    this._bindColorButton('center-color');
    this._bindSlider('center-size');
    this._bindSlider('center-icon-scale');

    // Child Item Settings.
    this._bindSwitch('child-auto-color');
    this._bindColorButton('child-color');
    this._bindSlider('child-size');
    this._bindSlider('child-offset');
    this._bindSlider('child-icon-scale');

    // Grandchild Item Settings.
    this._bindSwitch('grandchild-auto-color');
    this._bindColorButton('grandchild-color');
    this._bindSlider('grandchild-size');
    this._bindSlider('grandchild-offset');

    this.widget = this._builder.get_object('main-notebook');
  }

  _bindResetButton(settingsKey) {
    let resetButton = this._builder.get_object('reset-' + settingsKey);
    if (resetButton) {
      resetButton.connect('clicked', () => this._settings.reset(settingsKey));
    }
  }

  _bindSlider(settingsKey) {
    this._settings.bind(
        settingsKey, this._builder.get_object(settingsKey), 'value',
        Gio.SettingsBindFlags.DEFAULT);

    this._bindResetButton(settingsKey);
  }

  _bindSwitch(settingsKey) {
    this._settings.bind(
        settingsKey, this._builder.get_object(settingsKey), 'active',
        Gio.SettingsBindFlags.DEFAULT);

    this._bindResetButton(settingsKey);
  }

  // Gio.Settings.bind_with_mapping is not available yet, so we need to do the color
  // conversion like this. This requires the settingsKey + '-changed' signal to be added
  // to the ColorChooserButton in Glade.
  _bindColorButton(settingsKey) {
    let colorChooser = this._builder.get_object(settingsKey);

    this._widgetSignalHandlers[settingsKey + '-changed'] = () => this._settings.set_value(
        settingsKey, new GLib.Variant('s', colorChooser.get_rgba().to_string()));

    let settingSignalHandler = () => {
      let rgba = new Gdk.RGBA();
      rgba.parse(this._settings.get_string(settingsKey));
      colorChooser.rgba = rgba;
    };

    this._settings.connect('changed::' + settingsKey, settingSignalHandler);

    settingSignalHandler();

    this._bindResetButton(settingsKey);
  }
}


// Like 'extension.js' this is used for any one-time setup like translations.
function init() {}

// This function is called when the preferences window is first created to build
// and return a Gtk widget.
function buildPrefsWidget() {
  let settings = new Settings();
  return settings.widget;
}
