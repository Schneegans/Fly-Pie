//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const {Gtk, Gio, Gdk, GLib} = imports.gi;

const _ = imports.gettext.domain('flypie').gettext;

const Me            = imports.misc.extensionUtils.getCurrentExtension();
const utils         = Me.imports.src.common.utils;
const DBusInterface = Me.imports.src.common.DBusInterface.DBusInterface;
const Statistics    = Me.imports.src.common.Statistics.Statistics;
const Preset        = Me.imports.src.prefs.Preset.Preset;
const ExampleMenu   = Me.imports.src.prefs.ExampleMenu.ExampleMenu;

const DBusWrapper = Gio.DBusProxy.makeProxyWrapper(DBusInterface.description);

//////////////////////////////////////////////////////////////////////////////////////////
// The SettingsPage class encapsulates code required for the 'Menu Editor' page of      //
// the settings dialog. It's not instantiated multiple times, nor does it have any      //
// public interface, hence it could just be copy-pasted to the PreferencesDialog class. //
// But as it's quite decoupled (and huge) as well, it structures the code better when   //
// written to its own file.                                                             //
//////////////////////////////////////////////////////////////////////////////////////////

var SettingsPage = class SettingsPage {

  // ------------------------------------------------------------ constructor / destructor

  constructor(builder, settings) {

    // Keep a reference to the builder and the settings.
    this._builder  = builder;
    this._settings = settings;

    // We keep several connections to the Gio.Settings object. Once the settings dialog is
    // closed, we use this array to disconnect all of them.
    this._settingsConnections = [];

    // Initialize all buttons of the preset area.
    this._initializePresetButtons();

    // Connect to the server so that we can toggle menus also from the preferences. This
    // is, for example, used for toggling the Live-Preview.
    new DBusWrapper(
        Gio.DBus.session, 'org.gnome.Shell', '/org/gnome/shell/extensions/flypie',
        proxy => this._dbus = proxy);

    // Show the Demo Menu when the Preview Button is pressed.
    const previewButton = this._builder.get_object('preview-button');
    previewButton.connect('clicked', () => {
      if (this._dbus) {
        this._dbus.PreviewCustomMenuRemote(
            JSON.stringify(ExampleMenu.get()), (result) => {
              result = parseInt(result);
              if (result < 0) {
                const error = DBusInterface.getErrorDescription(result);
                utils.debug('Failed to open menu preview: ' + error);
              } else {
                Statistics.getInstance().addPreviewMenuOpened();
              }
            });
      }
    });

    // Now connect the user interface elements to the settings items. All user interface
    // elements have the same ID as the corresponding settings key. Sometimes there is
    // also a <key>-hover variant and a copy-<key> button. All three are connected with
    // the _bind* calls.

    // General Settings.
    this._bindSlider('global-scale');
    this._bindSlider('easing-duration');
    this._bindCombobox('easing-mode');
    this._bindColorButton('background-color');
    this._bindColorButton('text-color');
    this._bindFontButton('font');


    // Wedge Settings.
    this._bindSlider('wedge-width');
    this._bindSlider('wedge-inner-radius');
    this._bindColorButton('wedge-color');
    this._bindColorButton('wedge-separator-color');
    this._bindSlider('wedge-separator-width');

    // Center Item Settings.
    this._bindRadioGroup('center-color-mode', ['fixed', 'auto']);
    this._bindColorButton('center-fixed-color');
    this._bindSlider('center-auto-color-saturation');
    this._bindSlider('center-auto-color-luminance');
    this._bindSlider('center-auto-color-opacity');
    this._bindSlider('center-size');
    this._bindSlider('center-icon-scale');
    this._bindSlider('center-icon-crop');
    this._bindSlider('center-icon-opacity');
    this._bindFlyPieImageChooserButton('center-background-image');

    // Toggle the color revealers when the color mode radio buttons are toggled.
    this._bindRevealer('center-color-mode-fixed', 'center-fixed-color-revealer');
    this._bindRevealer('center-color-mode-auto', 'center-auto-color-revealer');
    this._bindRevealer(
        'center-color-mode-hover-fixed', 'center-fixed-color-hover-revealer');
    this._bindRevealer(
        'center-color-mode-hover-auto', 'center-auto-color-hover-revealer');

    // The copy-color-settings button copies various settings, so we bind it manually.
    this._builder.get_object('copy-center-color').connect('clicked', () => {
      this._copyToHover('center-color-mode');
      this._copyToHover('center-fixed-color');
      this._copyToHover('center-auto-color-saturation');
      this._copyToHover('center-auto-color-luminance');
      this._copyToHover('center-auto-color-opacity');
    });


    // Child Item Settings.
    this._bindRadioGroup('child-color-mode', ['fixed', 'auto', 'parent']);
    this._bindColorButton('child-fixed-color');
    this._bindSlider('child-auto-color-saturation');
    this._bindSlider('child-auto-color-luminance');
    this._bindSlider('child-auto-color-opacity');
    this._bindSlider('child-size');
    this._bindSlider('child-offset');
    this._bindSlider('child-icon-scale');
    this._bindSlider('child-icon-crop');
    this._bindSlider('child-icon-opacity');
    this._bindFlyPieImageChooserButton('child-background-image');
    this._bindSwitch('child-draw-above');

    // Toggle the color revealers when the color mode radio buttons are toggled.
    this._bindRevealer('child-color-mode-fixed', 'child-fixed-color-revealer');
    this._bindRevealer('child-color-mode-auto', 'child-auto-color-revealer');
    this._bindRevealer(
        'child-color-mode-hover-fixed', 'child-fixed-color-hover-revealer');
    this._bindRevealer('child-color-mode-hover-auto', 'child-auto-color-hover-revealer');

    // The copy-color-settings button copies various settings, so we bind it manually.
    this._builder.get_object('copy-child-color').connect('clicked', () => {
      this._copyToHover('child-color-mode');
      this._copyToHover('child-fixed-color');
      this._copyToHover('child-auto-color-saturation');
      this._copyToHover('child-auto-color-luminance');
      this._copyToHover('child-auto-color-opacity');
    });


    // Grandchild Item Settings.
    this._bindRadioGroup('grandchild-color-mode', ['fixed', 'parent']);
    this._bindColorButton('grandchild-fixed-color');
    this._bindSlider('grandchild-size');
    this._bindSlider('grandchild-offset');
    this._bindFlyPieImageChooserButton('grandchild-background-image');
    this._bindSwitch('grandchild-draw-above');

    // Toggle the color revealers when the color mode radio buttons are toggled.
    this._bindRevealer('grandchild-color-mode-fixed', 'grandchild-fixed-color-revealer');
    this._bindRevealer(
        'grandchild-color-mode-hover-fixed', 'grandchild-fixed-color-hover-revealer');

    // The copy-color-settings button copies various settings, so we bind it manually.
    this._builder.get_object('copy-grandchild-color').connect('clicked', () => {
      this._copyToHover('grandchild-color-mode');
      this._copyToHover('grandchild-fixed-color');
    });

    // Trace Settings.
    this._bindColorButton('trace-color');
    this._bindSlider('trace-min-length');
    this._bindSlider('trace-thickness');

    // Touch button settings.
    this._bindSlider('touch-buttons-opacity');
    this._bindSwitch('touch-buttons-show-in-overview-mode');
    this._bindSwitch('touch-buttons-show-in-desktop-mode');
    this._bindSwitch('touch-buttons-show-above-fullscreen');

    // Advanced Settings
    this._bindSlider('display-timeout');
    this._bindSlider('gesture-selection-timeout');
    this._bindSlider('gesture-jitter-threshold');
    this._bindSlider('gesture-min-stroke-length');
    this._bindSlider('gesture-min-stroke-angle');
    this._bindSwitch('hover-mode');
    this._bindSwitch('show-screencast-mouse');
    this._bindSwitch('achievement-notifications');
  }

  // Disconnects all settings connections.
  destroy() {
    this._settingsConnections.forEach(connection => {
      this._settings.disconnect(connection);
    });
  }

  // ----------------------------------------------------------------------- private stuff

  // This initializes the widgets related to the presets.
  _initializePresetButtons() {

    // Store some members will will use frequently.
    this._presetDirectory = Gio.File.new_for_path(Me.path + '/presets');
    this._presetList      = this._builder.get_object('preset-list');

    //  The sort column and type cannot be set in glade, so we do this here.
    this._presetList.set_sort_column_id(1, Gtk.SortType.ASCENDING);

    // Now add all presets to the user interface. We simply assume all *.json files in the
    // preset directory to be presets. No further checks are done for now...
    const presets = this._presetDirectory.enumerate_children(
        'standard::*', Gio.FileQueryInfoFlags.NONE, null);

    while (true) {
      const presetInfo = presets.next_file(null);

      if (presetInfo == null) {
        break;
      }

      if (presetInfo.get_file_type() == Gio.FileType.REGULAR) {
        const suffixPos = presetInfo.get_display_name().indexOf('.json');
        if (suffixPos > 0) {
          const presetFile = this._presetDirectory.get_child(presetInfo.get_name());
          const row        = this._presetList.append();
          const presetName = presetInfo.get_display_name().slice(0, suffixPos);
          this._presetList.set_value(row, 0, presetName);
          this._presetList.set_value(row, 1, presetFile.get_path());
        }
      }
    }

    // Load a preset whenever the selection changes.
    this._builder.get_object('preset-treeview')
        .connect('row-activated', (treeview, path) => {
          try {
            const [ok, iter] = treeview.get_model().get_iter(path);
            if (ok) {
              const path = treeview.get_model().get_value(iter, 1);
              Preset.load(Gio.File.new_for_path(path));
            }

          } catch (error) {
            utils.debug('Failed to load Preset: ' + error);
          }
        });

    // Open a save-dialog when the save button is pressed.
    this._builder.get_object('save-preset-button').connect('clicked', (button) => {
      const dialog = new Gtk.FileChooserDialog({
        action: Gtk.FileChooserAction.SAVE,
        transient_for: utils.getRoot(button),
        modal: true
      });

      // Show only *.json files per default.
      const jsonFilter = new Gtk.FileFilter();
      jsonFilter.set_name(_('JSON Files'));
      jsonFilter.add_mime_type('application/json');
      dialog.add_filter(jsonFilter);

      // But allow showing all files if required.
      const allFilter = new Gtk.FileFilter();
      allFilter.add_pattern('*');
      allFilter.set_name(_('All Files'));
      dialog.add_filter(allFilter);

      // Add our action buttons.
      dialog.add_button(_('Cancel'), Gtk.ResponseType.CANCEL);
      dialog.add_button(_('Save'), Gtk.ResponseType.OK);

      // Save preset file when the OK button is clicked.
      dialog.connect('response', (dialog, response_id) => {
        if (response_id === Gtk.ResponseType.OK) {
          try {
            let path = dialog.get_file().get_path();

            // Make sure we have a *.json extension.
            if (!path.endsWith('.json')) {
              path += '.json';
            }

            // Now save the preset!
            Preset.save(Gio.File.new_for_path(path));

            // Store this in our statistics.
            Statistics.getInstance().addPresetExport();

          } catch (error) {
            utils.debug('Failed to save preset: ' + error);
          }
        }

        dialog.destroy();
      });

      if (utils.gtk4()) {
        dialog.show();
      } else {
        dialog.show_all();
      }
    });

    this._builder.get_object('load-preset-button').connect('clicked', (button) => {
      const dialog = new Gtk.FileChooserDialog({
        action: Gtk.FileChooserAction.OPEN,
        transient_for: utils.getRoot(button),
        modal: true
      });

      // Show only *.json files per default.
      const jsonFilter = new Gtk.FileFilter();
      jsonFilter.set_name(_('JSON Files'));
      jsonFilter.add_mime_type('application/json');
      dialog.add_filter(jsonFilter);

      // But allow showing all files if required.
      const allFilter = new Gtk.FileFilter();
      allFilter.add_pattern('*');
      allFilter.set_name(_('All Files'));
      dialog.add_filter(allFilter);

      // Add our action buttons.
      dialog.add_button(_('Cancel'), Gtk.ResponseType.CANCEL);
      dialog.add_button(_('Load'), Gtk.ResponseType.OK);

      // Import settings when the OK button is clicked.
      dialog.connect('response', (dialog, response_id) => {
        if (response_id === Gtk.ResponseType.OK) {
          try {
            Preset.load(dialog.get_file());

            // Store this in our statistics.
            Statistics.getInstance().addPresetImport();

          } catch (error) {
            const errorMessage = new Gtk.MessageDialog({
              transient_for: utils.getRoot(button),
              modal: true,
              buttons: Gtk.ButtonsType.CLOSE,
              message_type: Gtk.MessageType.ERROR,
              text: _('Failed to load preset!'),
              secondary_text: '' + error
            });
            errorMessage.connect('response', d => d.destroy());
            errorMessage.show();
          }
        }

        dialog.destroy();
      });

      if (utils.gtk4()) {
        dialog.show();
      } else {
        dialog.show_all();
      }
    });

    // Create a random preset when the corresponding button is pressed.
    this._builder.get_object('random-preset-button').connect('clicked', () => {
      Preset.random();

      // Store this in our statistics.
      Statistics.getInstance().addRandomPreset();
    });
  }

  // This small helper method copies the settings value identified by <settingsKey> to the
  // value identified with <settingsKey>-hover.
  _copyToHover(settingsKey) {
    this._settings.set_value(
        settingsKey + '-hover', this._settings.get_value(settingsKey));
  }

  // This checks whether there is a copy-settings button for the given settings key and if
  // so, binds the _copyToHover method to it.
  _bindCopyButton(settingsKey) {
    const copyButton = this._builder.get_object('copy-' + settingsKey);
    if (copyButton) {
      copyButton.connect('clicked', () => {
        this._copyToHover(settingsKey);
      });
    }
  }

  // Connects a Gtk.Range (or anything else which has a 'value' property) to a settings
  // key. It also binds any corresponding copy buttons and '-hover' variants if they
  // exist.
  _bindSlider(settingsKey) {
    this._bind(settingsKey, 'value');
  }

  // Connects a Gtk.Switch (or anything else which has an 'active' property) to a settings
  // key. It also binds any corresponding copy buttons and '-hover' variants if they
  // exist.
  _bindSwitch(settingsKey) {
    this._bind(settingsKey, 'active');
  }

  // Connects a Gtk.FontButton (or anything else which has a 'font' property) to a
  // settings key. It also binds any corresponding copy buttons and '-hover' variants if
  // they exist.
  _bindFontButton(settingsKey) {
    this._bind(settingsKey, utils.gtk4() ? 'font' : 'font-name');
  }

  // Connects a Gtk.ComboBox (or anything else which has an 'active-id' property) to a
  // settings key. It also binds any corresponding copy buttons and '-hover' variants if
  // they exist.
  _bindCombobox(settingsKey) {
    this._bind(settingsKey, 'active-id');
  }

  // Connects any widget's property to a settings key. The widget must have the same ID as
  // the settings key. It also binds any corresponding copy buttons and '-hover' variants
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

    this._bindCopyButton(settingsKey);
  }

  // Connects a group of Gtk.RadioButtons to a string property of the settings. Foreach
  // 'value' in 'possibleValues', a toggle-handler is added to a button called
  // 'settingsKey-value'. This handler sets the 'settingsKey' to 'value'. The button state
  // is also updated when the corresponding setting changes.
  _bindRadioGroup(settingsKey, possibleValues) {

    // This is called once for 'settingsKey' and once for 'settingsKey-hover'.
    const impl = (settingsKey, possibleValues) => {
      possibleValues.forEach(value => {
        const button = this._builder.get_object(settingsKey + '-' + value);
        button.connect('toggled', () => {
          if (button.active) {
            this._settings.set_string(settingsKey, value);
          }
        });
      });

      // Update the button state when the settings change.
      const settingSignalHandler = () => {
        const value   = this._settings.get_string(settingsKey);
        const button  = this._builder.get_object(settingsKey + '-' + value);
        button.active = true;
      };

      this._settingsConnections.push(
          this._settings.connect('changed::' + settingsKey, settingSignalHandler));

      // Initialize the button with the state in the settings.
      settingSignalHandler();
    };

    // Bind the normal settingsKey.
    impl(settingsKey, possibleValues);

    // And any '-hover' variant if present.
    if (this._settings.settings_schema.has_key(settingsKey + '-hover')) {
      impl(settingsKey + '-hover', possibleValues);
    }

    // And bind the corresponding copy button.
    this._bindCopyButton(settingsKey);
  }

  // Binds the file path of a Gtk.FileChooserButton to a string setting. Since this path
  // is not a property of the FileChooserButton, we cannot simply connect it. Furthermore,
  // this behaves special for files which are part of Fly-Pie: All paths outside of
  // Fly-Pie's root directory are stored as absolute paths; paths which are descendants of
  // Me.path are stored as relative paths. The button state is also updated when the
  // corresponding setting changes. It also binds any corresponding copy buttons and
  // '-hover' variants if they exist.
  _bindFlyPieImageChooserButton(settingsKey) {

    // Called once for settingsKey and once for settingsKey + '-hover'.
    const impl = (key) => {
      // Check if there is such a button.
      const button = this._builder.get_object(key);
      if (button != null && this._settings.settings_schema.has_key(key)) {

        // Store the absolute file path when the user selects a file.
        button.connect('file-set', (widget) => {
          const file = widget.get_file();
          this._settings.set_string(key, file != null ? file.get_path() : '');
        });

        // This will be called whenever the settingsKey changes.
        const settingSignalHandler = () => {
          // If the settings key is empty (default state), reset the button.
          let path = this._settings.get_string(key);
          if (path == '') {
            button.set_file(null);
          } else {
            // If the path is a relative path, it may be a child of the preset directory.
            if (!GLib.path_is_absolute(path)) {
              path = Me.path + '/presets/' + path;
            }

            let file = Gio.File.new_for_path(path);
            button.set_file(file);
          }
        };

        // Connect the handler!
        this._settingsConnections.push(
            this._settings.connect('changed::' + key, settingSignalHandler));
        settingSignalHandler();
      }
    };

    impl(settingsKey);
    impl(settingsKey + '-hover');

    // And bind the corresponding copy button (if any).
    this._bindCopyButton(settingsKey);
  }

  // Colors are stored as strings like 'rgb(1, 0.5, 0)'. As Gio.Settings.bind_with_mapping
  // is not available yet, so we need to do the color conversion manually.
  _bindColorButton(settingsKey) {

    // This is called once for 'settingsKey' and once for 'settingsKey-hover'.
    const impl = (settingsKey) => {
      const colorChooser = this._builder.get_object(settingsKey);

      colorChooser.connect('color-set', () => {
        this._settings.set_string(settingsKey, colorChooser.get_rgba().to_string());
      });

      // Update the button state when the settings change.
      const settingSignalHandler = () => {
        const rgba = new Gdk.RGBA();
        rgba.parse(this._settings.get_string(settingsKey));
        colorChooser.rgba = rgba;
      };

      this._settingsConnections.push(
          this._settings.connect('changed::' + settingsKey, settingSignalHandler));

      // Initialize the button with the state in the settings.
      settingSignalHandler();
    };

    // Bind the normal settingsKey.
    impl(settingsKey);

    // And any '-hover' variant if present.
    if (this._settings.settings_schema.has_key(settingsKey + '-hover')) {
      impl(settingsKey + '-hover');
    }

    // And bind the corresponding copy button (if any).
    this._bindCopyButton(settingsKey);
  }

  // This makes sure that the revealer identified with revealerID is expanded whenever the
  // toggle button identified with toggleButtonID is active.
  _bindRevealer(toggleButtonID, revealerID) {
    this._builder.get_object(toggleButtonID).connect('toggled', (button) => {
      this._builder.get_object(revealerID).reveal_child = button.active;
    });

    this._builder.get_object(revealerID).reveal_child =
        this._builder.get_object(toggleButtonID).active;
  }
}