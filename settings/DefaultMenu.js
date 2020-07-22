//////////////////////////////////////////////////////////////////////////////////////////
//   _____       _             _____ _                                                  //
//  |   __|_ _ _|_|___ ___ ___|  _  |_|___   This software may be modified and distri-  //
//  |__   | | | | |   | . |___|   __| | -_|  buted under the terms of the MIT license.  //
//  |_____|_____|_|_|_|_  |   |__|  |_|___|  See the LICENSE file for details.          //
//                    |___|                                                             //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Gio = imports.gi.Gio;

//////////////////////////////////////////////////////////////////////////////////////////
// This creates a default menu configuration which is used when the user has no menus   //
// configured.                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////

var DefaultMenu = class DefaultMenu {

  // -------------------------------------------------------------------- public interface

  // Most parts of the menu are hard-coded. Some applications however are chosen based on
  // the user's defaults.
  static get() {

    const textEditor  = this._getForMimeType('text/plain');
    const audioPlayer = this._getForMimeType('audio/ogg');
    const videoPlayer = this._getForMimeType('video/ogg');
    const imageViewer = this._getForMimeType('image/jpg');
    const browser     = this._getForUri('http');
    const mailClient  = this._getForUri('mailto');

    return {
      name: 'Example Menu',
      icon: '🌟️',
      type: 'Menu',
      shortcut: '<Primary>4',
      id: 0,
      children: [
        {
          name: 'Sound',
          icon: 'multimedia-audio-player',
          type: 'Submenu',
          children: [
            {
              name: 'Play / Pause',
              icon: '⏯️',
              type: 'Shortcut',
              data: 'AudioPlay',
            },
            {
              name: 'Mute',
              icon: '🔈️',
              type: 'Shortcut',
              data: 'AudioMute',
            },
            {
              name: 'Next Title',
              icon: '⏩️',
              type: 'Shortcut',
              data: 'AudioNext',
              angle: 90
            },
            {
              name: 'Previous Title',
              icon: '⏪️',
              type: 'Shortcut',
              data: 'AudioPrev',
              angle: 270
            }
          ]
        },
        {
          name: 'Window Management',
          icon: 'preferences-system-windows',
          type: 'Submenu',
          children: [
            {
              name: 'Maximize Window',
              icon: 'view-fullscreen',
              type: 'Shortcut',
              data: '<Alt>F10',
            },
            {
              name: 'Open Windows',
              icon: 'preferences-system-windows',
              type: 'RunningApps',
            },
            {
              name: 'Gnome-Shell',
              icon: 'gnome-foot',
              type: 'Submenu',
              children: [
                {
                  name: 'Up',
                  icon: '🔼️',
                  type: 'Shortcut',
                  data: '<Primary><Alt>Up',
                  angle: 0
                },
                {
                  name: 'Overview',
                  icon: '💠️',
                  type: 'Shortcut',
                  data: '<Super>s',
                },
                {
                  name: 'Show Apps',
                  icon: 'view-grid',
                  type: 'Shortcut',
                  data: '<Super>a',
                },
                {
                  name: 'Down',
                  icon: '🔽️',
                  type: 'Shortcut',
                  data: '<Primary><Alt>Down',
                  angle: 180
                }
              ]
            },
            {
              name: 'Minimize Window',
              icon: 'go-bottom',
              type: 'Shortcut',
              data: '<Super>h',
            },
            {
              name: 'Close Window',
              icon: 'window-close',
              type: 'Shortcut',
              data: '<Alt>F4',
            }
          ]
        },
        {
          name: 'Bookmarks',
          icon: 'folder',
          type: 'Bookmarks',
        },
        {
          name: 'Default Apps',
          icon: 'emblem-favorite',
          type: 'Submenu',
          children: [
            {
              name: 'Internet',
              icon: 'applications-internet',
              type: 'Submenu',
              children: [
                browser,
                mailClient,
              ]
            },
            {
              name: 'Multimedia',
              icon: 'applications-multimedia',
              type: 'Submenu',
              children: [
                audioPlayer,
                videoPlayer,
                imageViewer,
              ]
            },
            {
              name: 'Utilities',
              icon: 'applications-accessories',
              type: 'Submenu',
              children: [
                textEditor, {
                  name: 'Swing-Pie Settings',
                  icon: 'gnome-settings',
                  type: 'Command',
                  data: 'gnome-extensions prefs swingpie@schneegans.github.com',
                },
                {
                  name: 'Terminal',
                  icon: 'org.gnome.Terminal',
                  type: 'Command',
                  data: 'gnome-terminal',
                },
                {
                  name: 'Files',
                  icon: 'org.gnome.Nautilus',
                  type: 'Command',
                  data: 'nautilus --new-window %U',
                },
                {
                  name: 'GNOME System Monitor',
                  icon: 'org.gnome.SystemMonitor',
                  type: 'Command',
                  data: 'gnome-system-monitor',
                }
              ]
            }
          ]
        }
      ]
    };
  }

  // ----------------------------------------------------------------------- private stuff

  // Returns an action configuration for an application which is default for the given
  // mime type. For example, "text/plain" will result in an action for Gedit on many
  // systems.
  static _getForMimeType(mimeType) {
    return this._getForAppInfo(Gio.AppInfo.get_default_for_type(mimeType, false));
  }

  // Returns an action configuration for an application which is default for the given uri
  // scheme. For example, "http" will result in an action for Firefox on many systems.
  static _getForUri(uri) {
    return this._getForAppInfo(Gio.AppInfo.get_default_for_uri_scheme(uri));
  }

  // Returns an action configuration for the given Gio.AppInfo.
  static _getForAppInfo(info) {
    return {
      name: info.get_display_name(),
      icon: info.get_icon().to_string(),
      type: 'Command',
      data: info.get_commandline()
    };
  }
}