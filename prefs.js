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

//////////////////////////////////////////////////////////////////////////////////////////
// This class loads the user interface defined in prefs.ui and connects all elements to //
// the corresponding settings items of the Gio.Settings at                              //
// org.gnome.shell.extensions.gnomepie2. All these connections work both ways - when a  //
// slider is moved in the user interface the corresponding settings key will be         //
// updated and when a settings key is modified, the corresponding slider is moved.      //
//////////////////////////////////////////////////////////////////////////////////////////

let Settings = class Settings {

  // ------------------------------------------------------------ constructor / destructor

  constructor() {

    // Create the Gio.Settings object.
    this._settings = utils.createSettings();

    // Load the user interface file.
    this._builder = new Gtk.Builder();
    this._builder.add_from_file(Me.path + '/prefs.ui');

    // Connect to the server so that we can toggle menus also from the preferences.
    new DBusWrapper(
        Gio.DBus.session, 'org.gnome.Shell', '/org/gnome/shell/extensions/gnomepie2',
        proxy => this._dbus = proxy);

    // Show the Demo Menu when the Preview Button is pressed.
    let previewButton = this._builder.get_object('preview-button');
    previewButton.connect('clicked', () => {
      if (this._dbus) {
        this._dbus.EditMenuRemote(JSON.stringify(this._createDemoMenu()), () => {});
      }
    });

    // Draw icons to the Gtk.DrawingAreas of the appearance tabs.
    this._createAppearanceTabIcons();

    // Now connect the user interface elements to the settings items.

    // General Settings. -----------------------------------------------------------------
    this._bindSlider('global-scale');
    this._bindSlider('animation-duration');
    this._bindColorButton('background-color');
    this._bindColorButton('text-color');
    this._bindFontButton('font');

    // Wedge Settings. -------------------------------------------------------------------
    this._bindSlider('wedge-size');
    this._bindColorButton('wedge-color');
    this._bindColorButton('active-wedge-color');
    this._bindColorButton('wedge-separator-color');

    // Center Item Settings. -------------------------------------------------------------

    // Toggle the color revealers when the color mode radio buttons are toggled.
    this._bindRevealer('center-color-mode-fixed', 'center-fixed-color-revealer');
    this._bindRevealer('center-color-mode-auto', 'center-auto-color-revealer');

    this._bindRadioGroup('center-color-mode', ['fixed', 'auto']);
    this._bindColorButton('center-fixed-color');
    this._bindSlider('center-auto-color-saturation');
    this._bindSlider('center-auto-color-luminance');
    this._bindSlider('center-size');
    this._bindSlider('center-icon-scale');

    // The color reset button resets various settings, so we bind it manually.
    this._builder.get_object('reset-center-color').connect('clicked', () => {
      this._settings.reset('center-color-mode');
      this._settings.reset('center-fixed-color');
      this._settings.reset('center-auto-color-saturation');
      this._settings.reset('center-auto-color-luminance');
    });


    // Child Item Settings. --------------------------------------------------------------

    // Toggle the color revealers when the color mode radio buttons are toggled.
    this._bindRevealer('child-color-mode-fixed', 'child-fixed-color-revealer');
    this._bindRevealer('child-color-mode-auto', 'child-auto-color-revealer');
    this._bindRevealer(
        'child-color-mode-hover-fixed', 'child-fixed-color-hover-revealer');
    this._bindRevealer('child-color-mode-hover-auto', 'child-auto-color-hover-revealer');

    this._bindRadioGroup('child-color-mode', ['fixed', 'auto', 'parent']);
    this._bindColorButton('child-fixed-color');
    this._bindSlider('child-auto-color-saturation');
    this._bindSlider('child-auto-color-luminance');
    this._bindSlider('child-size');
    this._bindSlider('child-offset');
    this._bindSlider('child-icon-scale');
    this._bindSwitch('child-draw-above');

    // The color reset button resets various settings, so we bind it manually.
    this._builder.get_object('reset-child-color').connect('clicked', () => {
      this._settings.reset('child-color-mode');
      this._settings.reset('child-color-mode-hover');
      this._settings.reset('child-fixed-color');
      this._settings.reset('child-auto-color-saturation');
      this._settings.reset('child-auto-color-luminance');
      this._settings.reset('child-fixed-color-hover');
      this._settings.reset('child-auto-color-saturation-hover');
      this._settings.reset('child-auto-color-luminance-hover');
    });


    // Grandchild Item Settings. ---------------------------------------------------------

    // Toggle the color revealers when the color mode radio buttons are toggled.
    this._bindRevealer('grandchild-color-mode-fixed', 'grandchild-fixed-color-revealer');
    this._bindRevealer(
        'grandchild-color-mode-hover-fixed', 'grandchild-fixed-color-hover-revealer');

    this._bindRadioGroup('grandchild-color-mode', ['fixed', 'parent']);
    this._bindColorButton('grandchild-fixed-color');
    this._bindSlider('grandchild-size');
    this._bindSlider('grandchild-offset');
    this._bindSwitch('grandchild-draw-above');

    // The color reset button resets various settings, so we bind it manually.
    this._builder.get_object('reset-grandchild-color').connect('clicked', () => {
      this._settings.reset('grandchild-color-mode');
      this._settings.reset('grandchild-color-mode-hover');
      this._settings.reset('grandchild-fixed-color');
      this._settings.reset('grandchild-fixed-color-hover');
    });

    // This is our top-level widget which we will return later.
    this._widget = this._builder.get_object('main-notebook');
  }

  // -------------------------------------------------------------------- public interface

  // Returns the widget used for the settings of this extension.
  getWidget() {
    return this._widget;
  }

  // ----------------------------------------------------------------------- private stuff

  // This is used by all the methods below. It checks whether there is a button called
  // 'reset-*whatever*' in the user interface. If so, it binds a click-handler to that
  // button resetting the corresponding settings key. It will also reset any setting
  // called 'settingsKey-hover' if one such exists.
  _bindResetButton(settingsKey) {
    let resetButton = this._builder.get_object('reset-' + settingsKey);
    if (resetButton) {
      resetButton.connect('clicked', () => {
        this._settings.reset(settingsKey);
        if (this._settings.settings_schema.has_key(settingsKey + '-hover')) {
          this._settings.reset(settingsKey + '-hover');
        }
      });
    }
  }

  // Connects a Gtk.Range (or anything else which has a 'value' property) to a settings
  // key. It also binds any corresponding reset buttons and '-hover' variants if they
  // exist.
  _bindSlider(settingsKey) {
    this._bind(settingsKey, 'value');
  }

  // Connects a Gtk.Switch (or anything else which has an 'active' property) to a settings
  // key. It also binds any corresponding reset buttons and '-hover' variants if they
  // exist.
  _bindSwitch(settingsKey) {
    this._bind(settingsKey, 'active');
  }

  // Connects a Gtk.FontButton (or anything else which has a 'font-name' property) to a
  // settings key. It also binds any corresponding reset buttons and '-hover' variants if
  // they exist.
  _bindFontButton(settingsKey) {
    this._bind(settingsKey, 'font-name');
  }

  // Connects any widget's property to a settings key. The widget must have the same ID as
  // the settings key. It also binds any corresponding reset buttons and '-hover' variants
  // if they exist.
  _bind(settingsKey, property) {
    this._settings.bind(
        settingsKey, this._builder.get_object(settingsKey), property,
        Gio.SettingsBindFlags.DEFAULT);

    if (this._settings.settings_schema.has_key(settingsKey + '-hover')) {
      this._settings.bind(
          settingsKey + '-hover', this._builder.get_object(settingsKey + '-hover'),
          property, Gio.SettingsBindFlags.DEFAULT);
    }

    this._bindResetButton(settingsKey);
  }

  // Connects a group of Gtk.RadioButtons to a string property of the settings. Foreach
  // 'value' in 'possibleValues', a toggle-handler is added to a button called
  // 'settingsKey-value'. This handler sets the 'settingsKey' to 'value'. The button state
  // is also updated when the corresponding setting changes.
  _bindRadioGroup(settingsKey, possibleValues) {

    // This is called once for 'settingsKey' and once for 'settingsKey-hover'.
    let impl = (settingsKey, possibleValues) => {
      possibleValues.forEach(value => {
        let button = this._builder.get_object(settingsKey + '-' + value);
        button.connect('toggled', () => {
          if (button.active) {
            this._settings.set_string(settingsKey, value);
          }
        });
      });

      // Update the button state when the settings change.
      let settingSignalHandler = () => {
        let value     = this._settings.get_string(settingsKey);
        let button    = this._builder.get_object(settingsKey + '-' + value);
        button.active = true;
      };

      this._settings.connect('changed::' + settingsKey, settingSignalHandler);

      // Initialize the button with the state in the settings.
      settingSignalHandler();
    };

    // Bind the normal settingsKey.
    impl(settingsKey, possibleValues);

    // And any '-hover' variant if present.
    if (this._settings.settings_schema.has_key(settingsKey + '-hover')) {
      impl(settingsKey + '-hover', possibleValues);
    }

    // And bind the corresponding reset button.
    this._bindResetButton(settingsKey);
  }

  // Colors are stored as strings like 'rgb(1, 0.5, 0)'. As Gio.Settings.bind_with_mapping
  // is not available yet, so we need to do the color conversion manually.
  _bindColorButton(settingsKey) {

    // This is called once for 'settingsKey' and once for 'settingsKey-hover'.
    let impl = (settingsKey) => {
      let colorChooser = this._builder.get_object(settingsKey);

      colorChooser.connect('color-set', () => {
        this._settings.set_string(settingsKey, colorChooser.get_rgba().to_string());
      });

      // Update the button state when the settings change.
      let settingSignalHandler = () => {
        let rgba = new Gdk.RGBA();
        rgba.parse(this._settings.get_string(settingsKey));
        colorChooser.rgba = rgba;
      };

      this._settings.connect('changed::' + settingsKey, settingSignalHandler);

      // Initialize the button with the state in the settings.
      settingSignalHandler();
    };

    // Bind the normal settingsKey.
    impl(settingsKey);

    // And any '-hover' variant if present.
    if (this._settings.settings_schema.has_key(settingsKey + '-hover')) {
      impl(settingsKey + '-hover');
    }

    // And bind the corresponding reset button.
    this._bindResetButton(settingsKey);
  }

  _bindRevealer(toggleButtonID, revealerID) {
    this._builder.get_object(toggleButtonID).connect('toggled', (button) => {
      this._builder.get_object(revealerID).reveal_child = button.active;
    });

    this._builder.get_object(revealerID).reveal_child =
        this._builder.get_object(toggleButtonID).active;
  }

  // This draws the custom icons of the appearance settings tabs.
  _createAppearanceTabIcons() {

    // We have to add these events to the Gtk.DrawingAreas to make them actually
    // clickable. Else it would not be possible to select the tabs.
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

  // This creates a Demo Menu structure which is shown when the preview button is pressed.
  _createDemoMenu() {
    return {
      name: 'Demo Menu', icon: 'firefox', items: [
        {
          name: 'Smileys',
          icon: 'firefox',
          items: [
            {name: 'Doughnut', icon: '🍩'},
            {name: 'Doughnut', icon: '🍩'},
            {name: 'Doughnut', icon: '🍩'},
            {name: 'Doughnut', icon: '🍩'},
            {name: 'Doughnut', icon: '🍩'},
          ]
        },
        {
          name: 'Animals',
          icon: 'folder',
          items: [
            {name: 'Doughnut', icon: '🍩'},
            {name: 'Doughnut', icon: '🍩'},
            {name: 'Doughnut', icon: '🍩'},
            {name: 'Doughnut', icon: '🍩'},
            {name: 'Doughnut', icon: '🍩'},
          ]
        },
        {
          name: 'Fruits',
          icon: '🥝',
          items: [
            {name: 'Doughnut', icon: '🍩'},
            {name: 'Doughnut', icon: '🍩'},
            {name: 'Doughnut', icon: '🍩'},
            {name: 'Doughnut', icon: '🍩'},
            {name: 'Doughnut', icon: '🍩'},
          ]
        },
        {
          name: 'Sports',
          icon: '⚽',
          items: [
            {name: 'Doughnut', icon: '🍩'},
            {name: 'Doughnut', icon: '🍩'},
            {name: 'Doughnut', icon: '🍩'},
            {name: 'Doughnut', icon: '🍩'},
            {name: 'Doughnut', icon: '🍩'},
          ]
        },
        {
          name: 'Vehicles',
          icon: '🚀',
          items: [
            {name: 'Doughnut', icon: '🍩'},
            {name: 'Doughnut', icon: '🍩'},
            {name: 'Doughnut', icon: '🍩'},
            {name: 'Doughnut', icon: '🍩'},
            {name: 'Doughnut', icon: '🍩'},
          ]
        },
        {
          name: 'Symbols',
          icon: '♍',
          items: [
            {name: 'Doughnut', icon: '🍩'},
            {name: 'Doughnut', icon: '🍩'},
            {name: 'Doughnut', icon: '🍩'},
            {name: 'Doughnut', icon: '🍩'},
            {name: 'Doughnut', icon: '🍩'},
          ]
        },
      ]
    }
  }
}

// ------------------------------------------------------------------------ global methods

// Like 'extension.js' this is used for any one-time setup like translations.
function init() {}

// This function is called when the preferences window is first created to build
// and return a Gtk widget.
function buildPrefsWidget() {
  let settings = new Settings();
  return settings.getWidget();
}
