//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const {GObject, Gio} = imports.gi;

const Main = imports.ui.main;

const Me    = imports.misc.extensionUtils.getCurrentExtension();
const utils = Me.imports.common.utils;

const _ = imports.gettext.domain('flypie').gettext;

//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////



var Achievements = class Achievements {

  // ------------------------------------------------------------ constructor / destructor

  constructor(settings) {

    // Keep a reference to the settings.
    this._settings = settings;

    // We keep several connections to the Gio.Settings object. Once the settings dialog is
    // closed, we use this array to disconnect all of them.
    this._settingsConnections = [];

    // If the click-selections statistics key changes (that means that the user selected
    // something by point-and-click), check for newly unlocked achievements.
    this._settingsConnections.push(
        this._settings.connect('changed::stats-click-selections', () => {
          this._notify(
              'Level up!', 'You just reached level 10!',
              Gio.icon_new_for_string(Me.path + '/resources/badges/levels/level10.png'));
        }));

    // If the gesture-selections statistics key changes (that means that the user selected
    // something with a gesture), check for newly unlocked achievements.
    this._settingsConnections.push(
        this._settings.connect('changed::stats-gesture-selections', () => {}));
  }

  // This should be called when the extension is unloaded. It disconnects handlers
  // registered with the Gio.Settings object.
  destroy() {
    this._settingsConnections.forEach(connection => {
      this._settings.disconnect(connection);
    });
  }

  // Shows a GNOME Shell notification with the given label, description and icon. The size
  // of the icon seems to depend on the currently used theme and cannot be set from here.
  _notify(label, details, gicon) {
    const source = new Main.MessageTray.Source('Fly-Pie', '');
    Main.messageTray.add(source);

    const n = new Main.MessageTray.Notification(source, label, details, {gicon: gicon});

    // Translators: This is shown on the action button of the notification bubble which is
    // shown once an achievement is unlocked.
    n.addAction(_('Show Achievements'), () => {
      // Make sure the achievements page is shown.
      this._settings.set_string('active-stack-child', 'achievements-page');

      // Show the settings dialog.
      Main.extensionManager.openExtensionPrefs(Me.uuid, '');
    });

    source.showNotification(n);
  }
}