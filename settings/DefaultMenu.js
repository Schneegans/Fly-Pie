//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Gio = imports.gi.Gio;

//////////////////////////////////////////////////////////////////////////////////////////
// This creates a default menu configuration which is used when the user has no menus   //
// configured.                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////

var DefaultMenu = class DefaultMenu {

  // -------------------------------------------------------------------- public interface

  static get() {

    const menu = {
      name: 'Example Menu',
      icon: '🌟️',
      type: 'Menu',
      shortcut: '<Primary>space',
      centered: false,
      id: 0,
      children: [
        {
          name: 'Sound',
          icon: 'audio-speakers',
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
              name: 'Gnome Shell',
              icon: 'preferences-desktop-remote-desktop',
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
                  name: 'Down',
                  icon: '🔽️',
                  type: 'Shortcut',
                  data: '<Primary><Alt>Down',
                  angle: 180
                },
                {
                  name: 'Show Apps',
                  icon: 'view-app-grid-symbolic',
                  type: 'Shortcut',
                  data: '<Super>a',
                }
              ]
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
          name: 'Fly-Pie Settings',
          icon: 'preferences-system',
          type: 'Command',
          data: 'gnome-extensions prefs flypie@schneegans.github.com',
        },
        {name: 'Favorites', icon: 'emblem-favorite', type: 'Favorites'}
      ]
    };

    return menu;
  }
}