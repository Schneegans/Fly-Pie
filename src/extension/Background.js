//////////////////////////////////////////////////////////////////////////////////////////
//                               ___            _     ___                               //
//                               |   |   \/    | ) |  |                                 //
//                           O-  |-  |   |  -  |   |  |-  -O                            //
//                               |   |_  |     |   |  |_                                //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

// SPDX-FileCopyrightText: Simon Schneegans <code@simonschneegans.de>
// SPDX-License-Identifier: MIT

'use strict';

import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import * as utils from '../common/utils.js';

const _ = await utils.importGettext();


//////////////////////////////////////////////////////////////////////////////////////////
// This Clutter.Actor represents the background behind the menu. It can be shown in     //
// normal mode and in preview mode. In normal mode, the background covers the entire    //
// screen and is pushed as modal, grabbing the complete user input. In preview mode the //
// background covers only one half of the monitor. Furthermore, the control buttons are //
// shown.                                                                               //
//////////////////////////////////////////////////////////////////////////////////////////

// clang-format off
export var Background = GObject.registerClass({
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
            this.ease({
              x: this._settings.get_boolean('preview-on-right-side') ?
                  this.width + Main.layoutManager.currentMonitor.x :
                  Main.layoutManager.currentMonitor.x,
              duration: this._settings.get_double('easing-duration') * 1000,
              mode: Clutter.AnimationMode.EASE_OUT_QUAD
            });
          }
        }));

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
    super.destroy();

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
      this.y = Main.layoutManager.currentMonitor.y;

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

      this.width  = global.stage.width;
      this.height = global.stage.height;
      this.x      = 0;
      this.y      = 0;

      // Remove any previous clips set in preview mode.
      this.remove_clip();

      // Actually this open() method can be called multiple times to toggle preview mode.
      // We only attempt to grab the input if we do not have it grabbed already.
      if (!this._isModal) {

        // Try to grab the complete input. If this fails that's not too bad as we're
        // full-screen.
        if (this._grab()) {
          this._isModal = true;
        } else {
          // Something went wrong while grabbing the input. For now, we continue but log
          // an corresponding message.
          utils.debug('Failed to grab input. Continuing anyways...');
        }
      }
    }

    // There might be a fade-out ongoing. This would make the actor invisible again once
    // completed. So we stop the transition if there is any.
    this.remove_transition('opacity');

    // Make the background visible and clickable.
    this.reactive = true;
    this.visible  = true;

    return true;
  }

  // The open() method above does not really show the background; it's still translucent.
  // The actual revealing is done by this method.
  reveal() {
    Meta.disable_unredirect_for_display(global.display);
    this.ease({
      opacity: 255,
      duration: this._settings.get_double('easing-duration') * 1000,
      mode: Clutter.AnimationMode.EASE_OUT_QUAD
    });
  }

  // This hides the background again. A fade-out animation is used for the opacity, but
  // the input is immediately un-grabbed allowing the user to click through the fading
  // background.
  close() {
    // Un-grab the input.
    if (this._isModal) {
      this._ungrab();
      this._isModal = false;
    }

    // Do not receive input events anymore.
    this.reactive = false;

    // Add the fade-out animation.
    this.ease({
      opacity: 0,
      duration: this._settings.get_double('easing-duration') * 1000,
      mode: Clutter.AnimationMode.EASE_OUT_QUAD,
      onStopped: () => {
        Meta.enable_unredirect_for_display(global.display);

        // Hide completely once the opacity has been faded to zero.
        this.visible = false;
      }
    });
  }

  // ----------------------------------------------------------------------- private stuff

  // This ensures that the entire input is sent to the background actor.
  _grab() {
    this._lastGrab = global.stage.grab(this);
    return this._lastGrab != null;
  }

  // Releases a grab created with the method above.
  _ungrab() {
    this._lastGrab.dismiss();
  }

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

    // Starting from GNOME 46, the add_actor method is removed. We need to use add_child
    // instead.
    if (box.add_actor) {
      box.add_actor(icon);
      box.add_actor(label);
    } else {
      box.add_child(icon);
      box.add_child(label);
    }

    const button = new St.Button({style_class: 'app-well-app'});
    button.set_child(box);
    button.connect('clicked', callback);

    this._controlButtons.add_child(button);
  }
});