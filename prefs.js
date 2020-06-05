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

    // Initialize all buttons of the preset area.
    this._initializePresetButtons();

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
    this._bindSlider('center-auto-color-alpha');
    this._bindSlider('center-size');
    this._bindSlider('center-icon-scale');

    // The color reset button resets various settings, so we bind it manually.
    this._builder.get_object('reset-center-color').connect('clicked', () => {
      this._settings.reset('center-color-mode');
      this._settings.reset('center-fixed-color');
      this._settings.reset('center-auto-color-saturation');
      this._settings.reset('center-auto-color-luminance');
      this._settings.reset('center-auto-color-alpha');
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
    this._bindSlider('child-auto-color-alpha');
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
      this._settings.reset('child-auto-color-alpha');
      this._settings.reset('child-fixed-color-hover');
      this._settings.reset('child-auto-color-saturation-hover');
      this._settings.reset('child-auto-color-luminance-hover');
      this._settings.reset('child-auto-color-alpha-hover');
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

  _initializePresetButtons() {
    // Add all presets to the user interface.
    this._presetDirectory  = Gio.File.new_for_path(Me.path + '/presets');
    this._presetList       = this._builder.get_object('preset-list');
    this._presetListSorted = this._builder.get_object('preset-list-sorted');
    this._presetListSorted.set_sort_column_id(1, Gtk.SortType.ASCENDING);

    let presets = this._presetDirectory.enumerate_children(
        'standard::*', Gio.FileQueryInfoFlags.NONE, null);

    let presetInfo;
    while (presetInfo = presets.next_file(null)) {
      if (presetInfo.get_file_type() == Gio.FileType.REGULAR) {
        let suffixPos = presetInfo.get_display_name().indexOf('.json');
        if (suffixPos > 0) {
          let presetFile = this._presetDirectory.get_child(presetInfo.get_name());
          let row        = this._presetList.append();
          this._presetList.set_value(
              row, 0, presetInfo.get_display_name().slice(0, suffixPos));
          this._presetList.set_value(row, 1, presetFile.get_path());
        }
      }
    }

    this._builder.get_object('preset-combobox').connect('changed', (combobox) => {
      let row  = combobox.get_active_iter()[1];
      let path = this._presetListSorted.get_value(row, 1);

      let file                = Gio.File.new_for_path(path);
      let [success, contents] = file.load_contents(null);

      try {
        if (success) {
          let settings = JSON.parse(contents);

          let read = (key) => {
            if (key in settings) {
              let value = settings[key];
              if (typeof value === 'string') {
                this._settings.set_string(key, value);
              } else if (typeof value === 'number') {
                this._settings.set_double(key, value);
              } else if (typeof value === 'boolean') {
                this._settings.set_boolean(key, value);
              }
            }
          };

          read('animation-duration');
          read('background-color');
          read('text-color');
          read('font');
          read('wedge-size');
          read('wedge-color');
          read('active-wedge-color');
          read('wedge-separator-color');
          read('center-color-mode');
          read('center-fixed-color');
          read('center-auto-color-saturation');
          read('center-auto-color-luminance');
          read('center-auto-color-alpha');
          read('center-size');
          read('center-icon-scale');
          read('child-color-mode');
          read('child-color-mode-hover');
          read('child-fixed-color');
          read('child-fixed-color-hover');
          read('child-auto-color-saturation');
          read('child-auto-color-saturation-hover');
          read('child-auto-color-luminance');
          read('child-auto-color-luminance-hover');
          read('child-auto-color-alpha');
          read('child-auto-color-alpha-hover');
          read('child-size');
          read('child-size-hover');
          read('child-offset');
          read('child-offset-hover');
          read('child-icon-scale');
          read('child-icon-scale-hover');
          read('child-draw-above');
          read('grandchild-color-mode');
          read('grandchild-color-mode-hover');
          read('grandchild-fixed-color');
          read('grandchild-fixed-color-hover');
          read('grandchild-size');
          read('grandchild-size-hover');
          read('grandchild-offset');
          read('grandchild-offset-hover');
          read('grandchild-draw-above');
        }

      } catch (error) {
        utils.notification('Failed to load preset: ' + error);
      }
    });

    this._builder.get_object('save-preset-button').connect('clicked', (button) => {
      let saver = new Gtk.FileChooserDialog({
        title: 'Save Preset',
        action: Gtk.FileChooserAction.SAVE,
        do_overwrite_confirmation: true
      });

      let jsonFilter = new Gtk.FileFilter();
      jsonFilter.set_name('JSON Files');
      jsonFilter.add_mime_type('application/json');

      let allFilter = new Gtk.FileFilter();
      allFilter.add_pattern('*');
      allFilter.set_name('All Files');

      saver.add_filter(jsonFilter);
      saver.add_filter(allFilter);

      saver.add_button('Cancel', Gtk.ResponseType.CANCEL);
      saver.add_button('Save', Gtk.ResponseType.OK);

      saver.set_current_folder_uri(this._presetDirectory.get_uri());

      saver.connect('response', (dialog, response_id) => {
        if (response_id === Gtk.ResponseType.OK) {
          try {
            let settings = {};

            let write = (key) => {
              if (this._settings.settings_schema.get_key(key)
                      .get_value_type()
                      .dup_string() === 's') {
                settings[key] = this._settings.get_string(key);
              } else if (
                  this._settings.settings_schema.get_key(key)
                      .get_value_type()
                      .dup_string() === 'd') {
                settings[key] = this._settings.get_double(key);
              } else if (
                  this._settings.settings_schema.get_key(key)
                      .get_value_type()
                      .dup_string() === 'b') {
                settings[key] = this._settings.get_boolean(key);
              }
            };

            write('animation-duration');
            write('background-color');
            write('text-color');
            write('font');
            write('wedge-size');
            write('wedge-color');
            write('active-wedge-color');
            write('wedge-separator-color');
            write('center-color-mode');
            write('center-fixed-color');
            write('center-auto-color-saturation');
            write('center-auto-color-luminance');
            write('center-auto-color-alpha');
            write('center-size');
            write('center-icon-scale');
            write('child-color-mode');
            write('child-color-mode-hover');
            write('child-fixed-color');
            write('child-fixed-color-hover');
            write('child-auto-color-saturation');
            write('child-auto-color-saturation-hover');
            write('child-auto-color-luminance');
            write('child-auto-color-luminance-hover');
            write('child-auto-color-alpha');
            write('child-auto-color-alpha-hover');
            write('child-size');
            write('child-size-hover');
            write('child-offset');
            write('child-offset-hover');
            write('child-icon-scale');
            write('child-icon-scale-hover');
            write('child-draw-above');
            write('grandchild-color-mode');
            write('grandchild-color-mode-hover');
            write('grandchild-fixed-color');
            write('grandchild-fixed-color-hover');
            write('grandchild-size');
            write('grandchild-size-hover');
            write('grandchild-offset');
            write('grandchild-offset-hover');
            write('grandchild-draw-above');

            let filename = dialog.get_filename();
            if (!filename.endsWith('.json')) {
              filename += '.json';
            }

            let file   = Gio.File.new_for_path(filename);
            let exists = file.query_exists(null);

            let success = file.replace_contents(
                JSON.stringify(settings, null, 2), null, false,
                Gio.FileCreateFlags.REPLACE_DESTINATION, null);

            if (success && !exists) {
              let fileInfo =
                  file.query_info('standard::*', Gio.FileQueryInfoFlags.NONE, null);
              let suffixPos = fileInfo.get_display_name().indexOf('.json');
              let row       = this._presetList.append();
              this._presetList.set_value(
                  row, 0, fileInfo.get_display_name().slice(0, suffixPos));
              this._presetList.set_value(row, 1, file.get_path());
            }

          } catch (error) {
            utils.notification('Failed to save preset: ' + error);
          }
        }

        dialog.destroy();
      });

      saver.show();
    });

    this._builder.get_object('open-preset-directory-button').connect('clicked', () => {
      Gio.AppInfo.launch_default_for_uri(this._presetDirectory.get_uri(), null);
    });
  }

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
