//////////////////////////////////////////////////////////////////////////////////////////
//   _____       _             _____ _                                                  //
//  |   __|_ _ _|_|___ ___ ___|  _  |_|___   This software may be modified and distri-  //
//  |__   | | | | |   | . |___|   __| | -_|  buted under the terms of the MIT license.  //
//  |_____|_____|_|_|_|_  |   |__|  |_|___|  See the LICENSE file for details.          //
//                    |___|                                                             //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const {Gio, Gdk} = imports.gi;

const Me    = imports.misc.extensionUtils.getCurrentExtension();
const utils = Me.imports.common.utils;

//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////

let settingsKeys = [
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
  'child-draw-above',
  'grandchild-color-mode',
  'grandchild-color-mode-hover',
  'grandchild-fixed-color',
  'grandchild-fixed-color-hover',
  'grandchild-size',
  'grandchild-size-hover',
  'grandchild-offset',
  'grandchild-offset-hover',
  'grandchild-draw-above'
];

var Preset = class Preset {

  // ---------------------------------------------------------------------- static methods

  static load(file) {
    try {
      const settings = utils.createSettings();

      let [success, contents] = file.load_contents(null);

      if (success) {
        let preset = JSON.parse(contents);

        settingsKeys.forEach(key => {
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

    } catch (error) {
      utils.notification('Failed to load preset: ' + error);
    }
  }

  static save(file) {
    try {
      const settings = utils.createSettings();
      let preset     = {};

      settingsKeys.forEach(key => {
        if (settings.settings_schema.get_key(key).get_value_type().dup_string() === 's') {
          preset[key] = settings.get_string(key);
        } else if (
            settings.settings_schema.get_key(key).get_value_type().dup_string() === 'd') {
          preset[key] = settings.get_double(key);
        } else if (
            settings.settings_schema.get_key(key).get_value_type().dup_string() === 'b') {
          preset[key] = settings.get_boolean(key);
        }
      });

      return file.replace_contents(
          JSON.stringify(preset, null, 2), null, false,
          Gio.FileCreateFlags.REPLACE_DESTINATION, null);

    } catch (error) {
      utils.notification('Failed to save preset: ' + error);
    }

    return false;
  }

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
  }
}