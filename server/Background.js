//////////////////////////////////////////////////////////////////////////////////////////
//                                                                                      //
//    _____                    ___  _     ___       This software may be modified       //
//   / ___/__  ___  __ _  ___ / _ \(_)__ |_  |      and distributed under the           //
//  / (_ / _ \/ _ \/  ' \/ -_) ___/ / -_) __/       terms of the MIT license. See       //
//  \___/_//_/\___/_/_/_/\__/_/  /_/\__/____/       the LICENSE file for details.       //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Main                        = imports.ui.main;
const {Clutter, Gio, GObject, St} = imports.gi;

const Me    = imports.misc.extensionUtils.getCurrentExtension();
const utils = Me.imports.common.utils;

//////////////////////////////////////////////////////////////////////////////////////////
// This Clutter.Actor represents the background behind the menu. It can be shown in     //
// normal mode and in edit mode. In normal mode, the background covers the entire       //
// screen and is pushed as modal, grabbing the complete user input. In edit mode the    //
// background covers only one half of the monitor. Furthermore, the control buttons are //
// shown.                                                                               //
//////////////////////////////////////////////////////////////////////////////////////////

// clang-format off
var Background = GObject.registerClass({
  Signals: {
    // Emitted when the save button is clicked.
    'edit-save': {},
    // Emitted when the cancel button is clicked.
    'edit-cancel': {}
  }
},
class Background extends Clutter.Actor {
  // clang-format on

  // ------------------------------------------------------------ constructor / destructor

  _init(params = {}) {
    super._init(params);

    this.height   = Main.layoutManager.currentMonitor.height;
    this.width    = Main.layoutManager.currentMonitor.width;
    this.reactive = false;
    this.visible  = false;
    this.opacity  = 0;

    // We transition everything. This is used for the position when in edit mode, the
    // opacity and the color.
    this.set_easing_duration(300);

    this._settings = utils.createSettings();

    // Set the background color according to the settings.
    this.backgroundColor =
        Clutter.Color.from_string(this._settings.get_string('background-color'))[1];

    // And update it in case of changes.
    this._settings.connect('changed::background-color', () => {
      this.backgroundColor =
          Clutter.Color.from_string(this._settings.get_string('background-color'))[1];
    });

    // Switch monitor side when the edit-mode-on-right-side settings key changes.
    this._settings.connect('changed::edit-mode-on-right-side', () => {
      if (this._editMode) {
        this.x = this._settings.get_boolean('edit-mode-on-right-side') ? this.width : 0;
      }
    });

    // Hide completely once the opacity has been faded to zero.
    this.connect('transitions-completed', () => {
      if (this.opacity == 0) {
        this.visible = false;
      }
    });

    // Create the control buttons container. This is shown in edit mode only.
    this._controlButtons = new St.Widget({
      style_class: 'switcher-list',
      layout_manager: new Clutter.BoxLayout({spacing: 10})
    });

    this._addControlButton('Save', 'document-save-symbolic', () => {
      this.emit('edit-save');
    });

    this._addControlButton('Cancel', 'window-close-symbolic', () => {
      this.emit('edit-cancel');
    });

    this._addControlButton('Flip Side', 'object-flip-horizontal-symbolic', () => {
      let key = 'edit-mode-on-right-side';
      this._settings.set_boolean(key, !this._settings.get_boolean(key));
    });

    this.add_child(this._controlButtons);
  }

  // -------------------------------------------------------------------- public interface

  // This makes the background visible. In normal mode, the background covers the entire
  // screen and is pushed as modal, grabbing the complete user input. In edit mode the
  // background covers only one half of the monitor. Furthermore, the control buttons are
  // shown.
  show(editMode) {

    this._editMode = editMode;

    if (this._editMode) {

      // Show the control buttons in edit mode.
      this._controlButtons.visible = true;

      // Set background size to one half of the monitor.
      this.width = Main.layoutManager.currentMonitor.width / 2;
      this.x     = this._settings.get_boolean('edit-mode-on-right-side') ? this.width : 0;

      // Put control buttons at the lower center.
      this._controlButtons.x =
          Main.layoutManager.currentMonitor.width / 4 - this._controlButtons.width / 2;
      this._controlButtons.y = Main.layoutManager.currentMonitor.height - 150;

    } else {

      // In normal mode, the background covers the entire screen and is pushed as modal,
      // grabbing the complete user input.
      this._controlButtons.visible = false;
      this.width                   = Main.layoutManager.currentMonitor.width;
      this.x                       = 0;

      // Try to grab the complete input.
      if (!Main.pushModal(this)) {
        // Something went wrong while grabbing the input. Let's abort this.
        return false;
      }
    }

    // Make the background visible and clickable.
    this.reactive = true;
    this.visible  = true;
    this.opacity  = 255;

    return true;
  }

  // This hides the background again. A fade-out animation is used for the opacity, but
  // the input is immediately un-grabbed allowing the user to click through the fading
  // background.
  hide() {
    // Un-grab the input.
    if (!this._editMode) {
      Main.popModal(this);
    }

    // Do not receive input events anymore.
    this.reactive = false;

    // Add the fade-out animation.
    this.opacity = 0;
  }

  // ----------------------------------------------------------------------- private stuff

  // This adds one button to the row of control buttons. We use a combination of app
  // switcher and dash button class names hoping that this looks good with most Gnome
  // Shell themes.
  _addControlButton(labelText, iconName, callback) {
    let icon = new St.Icon({
      gicon: Gio.Icon.new_for_string(iconName),
      fallback_icon_name: 'image-missing',
      icon_size: 32
    });

    let label = new St.Label({text: labelText});

    let box = new St.Widget({
      style_class: 'overview-icon',
      width: 100,
      layout_manager: new Clutter.BoxLayout({vertical: true, spacing: 5})
    });
    box.add_actor(icon);
    box.add_actor(label);

    let button = new St.Button({style_class: 'app-well-app'});
    button.set_child(box);
    button.connect('clicked', callback);

    this._controlButtons.add_child(button);
  }
});