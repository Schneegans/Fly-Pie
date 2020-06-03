//////////////////////////////////////////////////////////////////////////////////////////
//                                                                                      //
//    _____                    ___  _     ___       This software may be modified       //
//   / ___/__  ___  __ _  ___ / _ \(_)__ |_  |      and distributed under the           //
//  / (_ / _ \/ _ \/  ' \/ -_) ___/ / -_) __/       terms of the MIT license. See       //
//  \___/_//_/\___/_/_/_/\__/_/  /_/\__/____/       the LICENSE file for details.       //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const {Gtk, Gio, Gdk, GLib} = imports.gi;

const Me            = imports.misc.extensionUtils.getCurrentExtension();
const utils         = Me.imports.common.utils;
const DBusInterface = Me.imports.common.DBusInterface.DBusInterface;

const DBusWrapper = Gio.DBusProxy.makeProxyWrapper(DBusInterface.description);

let previewMenu = {
  name: 'Preview',
  icon: 'glade',
  items: [
    {name: 'Thunderbird', icon: 'thunderbird'}, {
      name: 'Firefox',
      icon: 'firefox',
      items: [{name: 'Gedit', icon: 'gedit'}, {name: 'Glade', icon: 'glade'}]
    }
  ]
}

let Settings = class Settings {
  constructor() {
    this._builder  = null;
    this._settings = utils.createSettings();

    this._builder = new Gtk.Builder();
    this._builder.add_from_file(Me.path + '/prefs.ui');

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

    this._createAppearanceTabIcons();

    // General Settings.
    this._bindSlider('global-scale');
    this._bindSlider('animation-duration');
    this._bindColorButton('text-color');
    this._bindColorButton('background-color');
    this._bindSlider('auto-color-saturation');
    this._bindSlider('auto-color-brightness');

    // Wedge Settings.
    this._bindSlider('wedge-size');
    this._bindColorButton('wedge-color');
    this._bindColorButton('active-wedge-color');
    this._bindColorButton('wedge-separator-color');

    // Center Item Settings.
    this._bindRadioGroup('center-color-mode', ['fixed', 'auto']);
    this._bindColorButton('center-color');
    this._bindSlider('center-size');
    this._bindSlider('center-icon-scale');

    // Child Item Settings.
    this._bindRadioGroup('child-color-mode', ['fixed', 'auto', 'parent']);
    this._bindColorButton('child-color');
    this._bindSlider('child-size');
    this._bindSlider('child-offset');
    this._bindSlider('child-icon-scale');
    this._bindSwitch('child-draw-above');

    // Grandchild Item Settings.
    this._bindRadioGroup('grandchild-color-mode', ['fixed', 'parent']);
    this._bindColorButton('grandchild-color');
    this._bindSlider('grandchild-size');
    this._bindSlider('grandchild-offset');
    this._bindSwitch('grandchild-draw-above');

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

  _bindRadioGroup(settingsKey, possibleValues) {
    possibleValues.forEach(value => {
      let button = this._builder.get_object(settingsKey + '-' + value);
      button.connect('toggled', () => {
        if (button.active) {
          this._settings.set_string(settingsKey, value);
        }
      });
    });

    let settingSignalHandler = () => {
      let value     = this._settings.get_string(settingsKey);
      let button    = this._builder.get_object(settingsKey + '-' + value);
      button.active = true;
    };

    this._settings.connect('changed::' + settingsKey, settingSignalHandler);

    // Initialize the button with the state in the settings.
    settingSignalHandler();

    this._bindResetButton(settingsKey);
  }

  // Gio.Settings.bind_with_mapping is not available yet, so we need to do the color
  // conversion like this.
  _bindColorButton(settingsKey) {
    let colorChooser = this._builder.get_object(settingsKey);

    colorChooser.connect('color-set', () => {
      this._settings.set_string(settingsKey, colorChooser.get_rgba().to_string());
    });

    let settingSignalHandler = () => {
      let rgba = new Gdk.RGBA();
      rgba.parse(this._settings.get_string(settingsKey));
      colorChooser.rgba = rgba;
    };

    this._settings.connect('changed::' + settingsKey, settingSignalHandler);

    // Initialize the button with the state in the settings.
    settingSignalHandler();

    this._bindResetButton(settingsKey);
  }

  _createAppearanceTabIcons() {

    let tabEvents = Gdk.EventMask.BUTTON_PRESS_MASK | Gdk.EventMask.BUTTON_RELEASE_MASK;

    // Draw six lines representing the wedge separators.

    let tabIcon = this._builder.get_object('wedges-tab-icon');
    tabIcon.add_events(tabEvents);
    tabIcon.connect('draw', (widget, ctx) => {
      let size  = Math.min(widget.get_allocated_width(), widget.get_allocated_height());
      let color = widget.get_style_context().get_color(Gtk.StateFlags.NORMAL);

      ctx.translate(size / 2, size / 2);
      ctx.rotate(2 * Math.PI / 12);

      for (let i = 0; i < 6; i++) {
        ctx.moveTo(size / 5, 0);
        ctx.lineTo(size / 2, 0);
        ctx.rotate(2 * Math.PI / 6);
      }

      ctx.setSourceRGBA(color.red, color.green, color.blue, color.alpha);
      ctx.setLineWidth(2);
      ctx.stroke();

      return false;
    });

    // Draw on circle representing the center item.
    tabIcon = this._builder.get_object('center-tab-icon');
    tabIcon.add_events(tabEvents);
    tabIcon.connect('draw', (widget, ctx) => {
      let size  = Math.min(widget.get_allocated_width(), widget.get_allocated_height());
      let color = widget.get_style_context().get_color(Gtk.StateFlags.NORMAL);

      ctx.translate(size / 2, size / 2);
      ctx.setSourceRGBA(color.red, color.green, color.blue, color.alpha);
      ctx.arc(0, 0, size / 4, 0, 2 * Math.PI);
      ctx.fill();

      return false;
    });

    // Draw six circles representing child items.
    tabIcon = this._builder.get_object('children-tab-icon');
    tabIcon.add_events(tabEvents);
    tabIcon.connect('draw', (widget, ctx) => {
      let size  = Math.min(widget.get_allocated_width(), widget.get_allocated_height());
      let color = widget.get_style_context().get_color(Gtk.StateFlags.NORMAL);

      ctx.translate(size / 2, size / 2);
      ctx.setSourceRGBA(color.red, color.green, color.blue, color.alpha);

      for (let i = 0; i < 6; i++) {
        ctx.rotate(2 * Math.PI / 6);
        ctx.arc(size / 3, 0, size / 10, 0, 2 * Math.PI);
        ctx.fill();
      }

      return false;
    });

    // Draw six groups of five grandchildren each. The grandchild at the back-navigation
    // position is skipped.
    tabIcon = this._builder.get_object('grandchildren-tab-icon');
    tabIcon.add_events(tabEvents);
    tabIcon.connect('draw', (widget, ctx) => {
      let size  = Math.min(widget.get_allocated_width(), widget.get_allocated_height());
      let color = widget.get_style_context().get_color(Gtk.StateFlags.NORMAL);

      ctx.translate(size / 2, size / 2);
      ctx.setSourceRGBA(color.red, color.green, color.blue, color.alpha);

      for (let i = 0; i < 6; i++) {
        ctx.rotate(2 * Math.PI / 6);

        ctx.save()
        ctx.translate(size / 3, 0);
        ctx.rotate(Math.PI);

        for (let j = 0; j < 5; j++) {
          ctx.rotate(2 * Math.PI / 6);
          ctx.arc(size / 10, 0, size / 20, 0, 2 * Math.PI);
          ctx.fill();
        }

        ctx.restore();
      }

      return false;
    });
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
