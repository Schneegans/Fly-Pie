//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const {Gio, Gdk, GLib} = imports.gi;

const Me    = imports.misc.extensionUtils.getCurrentExtension();
const utils = Me.imports.src.common.utils;

//////////////////////////////////////////////////////////////////////////////////////////
// Presets of Fly-Pie are stored in the JSON format. These files contain values for a   //
// subset of Fly-Pie's settings. The subset is defined in the presetKeys list below.    //
//////////////////////////////////////////////////////////////////////////////////////////

// These settings keys are stored in a preset. The load() and save() methods below just
// iterate over this list and read / write the corresponding settings values from / to a
// JSON file. For now, this works for setting keys of type double, string, boolean and
// for enums. If new setting types are added, the save() and load() methods below need to
// be changed.
let presetKeys = [
  'easing-duration',
  'easing-mode',
  'background-color',
  'text-color',
  'font',
  'wedge-width',
  'wedge-inner-radius',
  'wedge-color',
  'wedge-color-hover',
  'wedge-separator-color',
  'wedge-separator-width',
  'center-color-mode',
  'center-color-mode-hover',
  'center-fixed-color',
  'center-fixed-color-hover',
  'center-auto-color-saturation',
  'center-auto-color-saturation-hover',
  'center-auto-color-luminance',
  'center-auto-color-luminance-hover',
  'center-auto-color-opacity',
  'center-auto-color-opacity-hover',
  'center-size',
  'center-size-hover',
  'center-icon-scale',
  'center-icon-scale-hover',
  'center-icon-opacity',
  'center-icon-opacity-hover',
  'center-icon-crop',
  'center-icon-crop-hover',
  'center-background-image',
  'center-background-image-hover',
  'child-color-mode',
  'child-color-mode-hover',
  'child-fixed-color',
  'child-fixed-color-hover',
  'child-auto-color-saturation',
  'child-auto-color-saturation-hover',
  'child-auto-color-luminance',
  'child-auto-color-luminance-hover',
  'child-auto-color-opacity',
  'child-auto-color-opacity-hover',
  'child-size',
  'child-size-hover',
  'child-offset',
  'child-offset-hover',
  'child-icon-scale',
  'child-icon-scale-hover',
  'child-icon-opacity',
  'child-icon-opacity-hover',
  'child-icon-crop',
  'child-icon-crop-hover',
  'child-background-image',
  'child-background-image-hover',
  'child-draw-above',
  'grandchild-color-mode',
  'grandchild-color-mode-hover',
  'grandchild-fixed-color',
  'grandchild-fixed-color-hover',
  'grandchild-size',
  'grandchild-size-hover',
  'grandchild-offset',
  'grandchild-offset-hover',
  'grandchild-background-image',
  'grandchild-background-image-hover',
  'grandchild-draw-above',
  'trace-min-length',
  'trace-thickness',
  'trace-color',
  'touch-buttons-opacity',
];

var Preset = class Preset {

  // ---------------------------------------------------------------------- static methods

  // Initializes all presetKeys of 'org.gnome.shell.extensions.flypie' to the values set
  // in the given JSON Gio.File. This may throw an error if something goes wrong.
  static load(file) {

    const [success, contents] = file.load_contents(null);

    if (success) {
      const preset   = JSON.parse(contents);
      const settings = utils.createSettings();

      presetKeys.forEach(key => {
        if (key in preset) {
          let value = preset[key];
          if (typeof value === 'string') {
            settings.set_string(key, value);
          } else if (typeof value === 'number') {
            settings.set_double(key, value);
          } else if (typeof value === 'boolean') {
            settings.set_boolean(key, value);
          }
        } else if (settings.settings_schema.has_key(key)) {
          settings.reset(key);
        }
      });
    }
  }

  // Retrieves all presetKeys from 'org.gnome.shell.extensions.flypie' and stores them
  // in the given Gio.File in the JSON format. This may throw an error if something goes
  // wrong.
  static save(file) {
    const settings = utils.createSettings();
    let preset     = {};

    presetKeys.forEach(key => {
      const type = settings.settings_schema.get_key(key).get_value_type().dup_string();
      if (type === 's') {

        preset[key] = settings.get_string(key);

        // There's a special case for the image keys. They are allowed to be relative
        // paths to the preset file to make sharing of presets easier. So we should
        // convert the absolute path to a relative one here.
        if (key.includes('image')) {
          const path         = Gio.File.new_for_path(preset[key]);
          const relativePath = file.get_parent().get_relative_path(path);
          if (relativePath != null) {
            preset[key] = relativePath;
          }
        }

      } else if (type === 'd') {
        preset[key] = settings.get_double(key);
      } else if (type === 'b') {
        preset[key] = settings.get_boolean(key);
      }
    });

    return file.replace_contents(
        JSON.stringify(preset, null, 2), null, false,
        Gio.FileCreateFlags.REPLACE_DESTINATION, null);
  }

  // This initializes most presetKeys to random values. This is more fun than actually
  // useful...
  static random() {

    const settings = utils.createSettings();

    let setRandomDouble = (key, min, max) => {
      settings.set_double(key, min + Math.random() * (max - min));
    };

    let setRandomString = (key, values) => {
      let index = Math.floor(Math.random() * values.length);
      settings.set_string(key, values[index]);
    };

    let setRandomBool = (key) => {
      settings.set_boolean(key, Math.random() > 0.5);
    };

    let setRandomColor = (key) => {
      let color   = new Gdk.RGBA();
      color.red   = Math.random();
      color.green = Math.random();
      color.blue  = Math.random();
      color.alpha = Math.random();
      settings.set_string(key, color.to_string());
    };

    setRandomDouble('easing-duration', 0.1, 0.3);
    setRandomColor('background-color');
    setRandomColor('text-color');
    setRandomDouble('wedge-width', 100, 500);
    setRandomDouble('wedge-inner-radius', 50, 100);
    setRandomColor('wedge-color');
    setRandomColor('wedge-color-hover');
    setRandomColor('wedge-separator-color');
    setRandomDouble('wedge-separator-width', 1, 5);
    setRandomString('center-color-mode', ['fixed', 'auto']);
    setRandomString('center-color-mode-hover', ['fixed', 'auto']);
    setRandomColor('center-fixed-color');
    setRandomColor('center-fixed-color-hover');
    setRandomDouble('center-auto-color-saturation', 0, 1);
    setRandomDouble('center-auto-color-saturation-hover', 0, 1);
    setRandomDouble('center-auto-color-luminance', 0, 1);
    setRandomDouble('center-auto-color-luminance-hover', 0, 1);
    setRandomDouble('center-auto-color-opacity', 0, 1);
    setRandomDouble('center-auto-color-opacity-hover', 0, 1);
    setRandomDouble('center-size', 50, 150);
    setRandomDouble('center-size-hover', 50, 150);
    setRandomDouble('center-icon-scale', 0.5, 1.0);
    setRandomDouble('center-icon-scale-hover', 0.5, 1.0);
    setRandomDouble('center-icon-opacity', 0.0, 0.5);
    setRandomDouble('center-icon-opacity-hover', 1.0, 1.0);
    setRandomString('child-color-mode', ['fixed', 'auto', 'parent']);
    setRandomString('child-color-mode-hover', ['fixed', 'auto', 'parent']);
    setRandomColor('child-fixed-color');
    setRandomColor('child-fixed-color-hover');
    setRandomDouble('child-auto-color-saturation', 0, 1);
    setRandomDouble('child-auto-color-saturation-hover', 0, 1);
    setRandomDouble('child-auto-color-luminance', 0, 1);
    setRandomDouble('child-auto-color-luminance-hover', 0, 1);
    setRandomDouble('child-auto-color-opacity', 0, 1);
    setRandomDouble('child-auto-color-opacity-hover', 0, 1);
    setRandomDouble('child-size', 30, 80);
    setRandomDouble('child-size-hover', 50, 100);
    setRandomDouble('child-offset', 50, 150);
    setRandomDouble('child-offset-hover', 80, 180);
    setRandomDouble('child-icon-scale', 0.5, 1.0);
    setRandomDouble('child-icon-scale-hover', 0.8, 1.0);
    setRandomDouble('child-icon-opacity', 0.5, 1.0);
    setRandomDouble('child-icon-opacity-hover', 1.0, 1.0);
    setRandomBool('child-draw-above');
    setRandomString('grandchild-color-mode', ['fixed', 'parent']);
    setRandomString('grandchild-color-mode-hover', ['fixed', 'parent']);
    setRandomColor('grandchild-fixed-color');
    setRandomColor('grandchild-fixed-color-hover');
    setRandomDouble('grandchild-size', 3, 15);
    setRandomDouble('grandchild-size-hover', 8, 25);
    setRandomDouble('grandchild-offset', 15, 40);
    setRandomDouble('grandchild-offset-hover', 25, 60);
    setRandomBool('grandchild-draw-above');
    setRandomDouble('trace-min-length', 200, 400);
    setRandomDouble('trace-thickness', 2, 20);
    setRandomColor('trace-color');
  }
}