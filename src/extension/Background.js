//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Main                        = imports.ui.main;
const {Clutter, Gio, GObject, St} = imports.gi;

const Me    = imports.misc.extensionUtils.getCurrentExtension();
const utils = Me.imports.src.common.utils;

const _ = imports.gettext.domain('flypie').gettext;

//////////////////////////////////////////////////////////////////////////////////////////
// This Clutter.Actor represents the background behind the menu. It can be shown in     //
// normal mode and in preview mode. In normal mode, the background covers the entire    //
// screen and is pushed as modal, grabbing the complete user input. In preview mode the //
// background covers only one half of the monitor. Furthermore, the control buttons are //
// shown.                                                                               //
//////////////////////////////////////////////////////////////////////////////////////////

// clang-format off
var Background = GObject.registerClass({
  Properties: {},
  Signals: {
    // Emitted when the close button is clicked.
    'close-event': {}
  }
},
class Background extends Clutter.Actor {
  // clang-format on

  // ------------------------------------------------------------ constructor / destructor

  _init(params = {}) {
    super._init(params);

    this.height  = Main.layoutManager.currentMonitor.height;
    this.width   = Main.layoutManager.currentMonitor.width;
    this.visible = false;
    this.opacity = 0;

    // Will be true as long as we have the input grabbed.
    this._isModal = false;

    // We keep several connections to the Gio.Settings object. Once the settings dialog is
    // closed, we use this array to disconnect all of them.
    this._settings            = utils.createSettings();
    this._settingsConnections = [];

    // We transition everything. This is used for the position when in preview mode, the
    // opacity and the color.
    this.set_easing_duration(this._settings.get_double('easing-duration') * 1000);

    // And update it in case of changes.
    this._settingsConnections.push(
        this._settings.connect('changed::easing-duration', () => {
          this.set_easing_duration(this._settings.get_double('easing-duration') * 1000);
        }));

    // Set the background color according to the settings.
    this.backgroundColor =
        Clutter.Color.from_string(this._settings.get_string('background-color'))[1];

    // And update it in case of changes.
    this._settingsConnections.push(
        this._settings.connect('changed::background-color', () => {
          this.backgroundColor =
              Clutter.Color.from_string(this._settings.get_string('background-color'))[1];
        }));

    // Switch monitor side when the preview-on-right-side settings key changes.
    this._settingsConnections.push(
        this._settings.connect('changed::preview-on-right-side', () => {
          if (this._previewMode) {
            // Set x accounting monitor x as a starting point
            this.x = this._settings.get_boolean('preview-on-right-side') ?
                this.width + Main.layoutManager.currentMonitor.x :
                Main.layoutManager.currentMonitor.x;
          }
        }));

    // Hide completely once the opacity has been faded to zero.
    this.connect('transitions-completed', () => {
      if (this.opacity == 0) {
        this.visible = false;
      }
    });

    // Create the control buttons container. This is shown in preview mode only.
    this._controlButtons = new St.Widget({
      style_class: 'switcher-list',
      layout_manager: new Clutter.BoxLayout({spacing: 10})
    });

    this._addControlButton(_('Close'), 'window-close-symbolic', () => {
      this.emit('close-event');
    });

    // Translators: This means 'Change the side of the screen where the Preview menu is
    // opened'.
    this._addControlButton(_('Flip Side'), 'object-flip-horizontal-symbolic', () => {
      const key = 'preview-on-right-side';
      this._settings.set_boolean(key, !this._settings.get_boolean(key));
    });

    this.add_child(this._controlButtons);
  }

  // Disconnects all settings connections.
  destroy() {
    this._settingsConnections.forEach(connection => {
      this._settings.disconnect(connection);
    });
  }

  // -------------------------------------------------------------------- public interface

  // This makes the background visible. In normal mode, the background covers the entire
  // screen and is pushed as modal, grabbing the complete user input. In preview mode the
  // background covers only one half of the monitor. Furthermore, the control buttons are
  // shown.
  open(previewMode) {

    this._previewMode = previewMode;

    if (this._previewMode) {

      // Show the control buttons in preview mode.
      this._controlButtons.visible = true;

      // Set background size to one half of the monitor.
      this.width  = Main.layoutManager.currentMonitor.width / 2;
      this.height = Main.layoutManager.currentMonitor.height;
      // Set x accounting monitor x as a starting point
      this.x = this._settings.get_boolean('preview-on-right-side') ?
          this.width + Main.layoutManager.currentMonitor.x :
          Main.layoutManager.currentMonitor.x;
      this.y =
          Main.layoutManager.currentMonitor.y;  // Needed for vertical monitor alignment
      // Do not draw outside our preview-mode screen-side.
      this.set_clip(0, 0, this.width, this.height);

      // Put control buttons at the lower center.
      this._controlButtons.x =
          Main.layoutManager.currentMonitor.width / 4 - this._controlButtons.width / 2;
      this._controlButtons.y = Main.layoutManager.currentMonitor.height - 150;

    } else {

      // In normal mode, the background covers the entire screen and is pushed as modal,
      // grabbing the complete user input.
      this._controlButtons.visible = false;
      this.width                   = Main.layoutManager.currentMonitor.width;
      this.height                  = Main.layoutManager.currentMonitor.height;
      this.x =
          Main.layoutManager.currentMonitor.x;  // Needed for horizontal monitor alignment
      this.y =
          Main.layoutManager.currentMonitor.y;  // Needed for vertical monitor alignment

      // Remove any previous clips set in preview mode.
      this.remove_clip();

      // Actually this open() method can be called multiple times to toggle preview mode.
      // We only attempt to grab the input if we do not have it grabbed already.
      if (!this._isModal) {

        // Try to grab the complete input. If this fails that's not too bad as we're
        // full-screen.
        if (Main.pushModal(this)) {
          this._isModal = true;
        } else {
          // Something went wrong while grabbing the input. For now, we continue but log
          // an corresponding message.
          utils.debug('Failed to grab input. Continuing anyways...');
        }
      }
    }

    // Make the background visible and clickable.
    this.reactive = true;
    this.visible  = true;

    return true;
  }

  // The open() method above does not really show the background; it's still translucent.
  // The actual revealing is done by this method.
  reveal() {
    this.opacity = 255;
  }

  // This hides the background again. A fade-out animation is used for the opacity, but
  // the input is immediately un-grabbed allowing the user to click through the fading
  // background.
  close() {
    // Un-grab the input.
    if (this._isModal) {
      Main.popModal(this);
      this._isModal = false;
    }

    // Do not receive input events anymore.
    this.reactive = false;

    // Add the fade-out animation.
    this.opacity = 0;
  }

  // ----------------------------------------------------------------------- private stuff

  // This adds one button to the row of control buttons. We use a combination of app
  // switcher and dash button class names hoping that this looks good with most GNOME
  // Shell themes.
  _addControlButton(labelText, iconName, callback) {
    const icon = new St.Icon({
      gicon: Gio.Icon.new_for_string(iconName),
      fallback_icon_name: 'image-missing',
      icon_size: 32
    });

    const label = new St.Label({text: labelText});

    // Starting from Clutter 1.12, there is a Clutter.Orientation enum for switching the
    // direction of the Clutter.BoxLayout.
    const boxLayoutParams = {spacing: 5};
    if (Clutter.Orientation) {
      boxLayoutParams.orientation = Clutter.Orientation.VERTICAL;
    } else {
      boxLayoutParams.vertical = true;
    }

    const box = new St.Widget({
      style_class: 'overview-icon',
      width: 100,
      layout_manager: new Clutter.BoxLayout(boxLayoutParams)
    });
    box.add_actor(icon);
    box.add_actor(label);

    const button = new St.Button({style_class: 'app-well-app'});
    button.set_child(box);
    button.connect('clicked', callback);

    this._controlButtons.add_child(button);
  }
});