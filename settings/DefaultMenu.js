//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Gio = imports.gi.Gio;

const _ = imports.gettext.domain('flypie').gettext;

//////////////////////////////////////////////////////////////////////////////////////////
// This creates a default menu configuration which is used when the user has no menus   //
// configured.                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////

var DefaultMenu = class DefaultMenu {

  // ---------------------------------------------------------------------- static methods

  static get() {

    const menu = {
      name: _('Example Menu'),
      icon: '🌟️',
      type: 'Menu',
      shortcut: '<Primary>space',
      centered: false,
      id: 0,
      children: [
        {
          name: _('Sound'),
          icon: 'audio-speakers',
          type: 'Submenu',
          children: [
            {
              name: _('Play / Pause'),
              icon: '⏯️',
              type: 'Shortcut',
              data: 'AudioPlay',
            },
            {
              name: _('Mute'),
              icon: '🔈️',
              type: 'Shortcut',
              data: 'AudioMute',
            },
            {
              name: _('Next Title'),
              icon: '⏩️',
              type: 'Shortcut',
              data: 'AudioNext',
              angle: 90
            },
            {
              name: _('Previous Title'),
              icon: '⏪️',
              type: 'Shortcut',
              data: 'AudioPrev',
              angle: 270
            }
          ]
        },
        {
          name: _('Window Management'),
          icon: 'preferences-system-windows',
          type: 'Submenu',
          children: [
            {
              name: _('Maximize Window'),
              icon: 'view-fullscreen',
              type: 'Shortcut',
              data: '<Alt>F10',
            },
            {
              name: _('Gnome Shell'),
              icon: 'preferences-desktop-remote-desktop',
              type: 'Submenu',
              children: [
                {
                  name: _('Up'),
                  icon: '🔼️',
                  type: 'Shortcut',
                  data: '<Primary><Alt>Up',
                  angle: 0
                },
                {
                  name: _('Overview'),
                  icon: '💠️',
                  type: 'Shortcut',
                  data: '<Super>s',
                },
                {
                  name: _('Down'),
                  icon: '🔽️',
                  type: 'Shortcut',
                  data: '<Primary><Alt>Down',
                  angle: 180
                },
                {
                  name: _('Show Apps'),
                  icon: 'view-app-grid-symbolic',
                  type: 'Shortcut',
                  data: '<Super>a',
                }
              ]
            },
            {
              name: _('Open Windows'),
              icon: 'preferences-system-windows',
              type: 'RunningApps',
            },
            {
              name: _('Close Window'),
              icon: 'window-close',
              type: 'Shortcut',
              data: '<Alt>F4',
            }
          ]
        },
        {
          name: _('Bookmarks'),
          icon: 'folder',
          type: 'Bookmarks',
        },
        {
          name: _('Fly-Pie Settings'),
          icon: 'preferences-system',
          type: 'Command',
          data: 'gnome-extensions prefs flypie@schneegans.github.com',
        },
        {name: _('Favorites'), icon: 'emblem-favorite', type: 'Favorites'},
        {name: _('System'), icon: 'system-log-out', type: 'System'}
      ]
    };

    return menu;
  }
}