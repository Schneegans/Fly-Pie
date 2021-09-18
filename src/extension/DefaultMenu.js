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
      // Translators: This is the name of the default menu.
      'name': _('Example Menu'),
      'icon': '🌟️',
      'shortcut': '<Primary>space',
      'centered': false,
      'id': 0,
      'children': [
        {
          // Translators: This is an entry of the default menu.
          'name': _('Window Management'),
          'icon': 'desktop',
          'children': [
            {
              // Translators: This is an entry of the default menu.
              'name': _('Open Windows'),
              'icon': 'preferences-system-windows',
              'type': 'RunningApps',
              'data': {
                'activeWorkspaceOnly': false,
                'appGrouping': true,
                'hoverPeeking': true,
                'nameRegex': ''
              },
              'angle': -1
            },
            {
              // Translators: This is an entry of the default menu.
              'name': _('Close Window'),
              'icon': 'window-close',
              'type': 'Shortcut',
              'data': '<Alt>F4',
              'angle': -1
            },
            {
              // Translators: This is an entry of the default menu.
              'name': _('Right'),
              'icon': '▶️',
              'type': 'Shortcut',
              'data': {'shortcut': '<Control><Alt>Right'},
              'angle': 90
            },
            {
              // Translators: This is an entry of the default menu.
              'name': _('Left'),
              'icon': '◀️',
              'type': 'Shortcut',
              'data': {'shortcut': '<Control><Alt>Left'},
              'angle': 270
            },
            {
              // Translators: This is an entry of the default menu.
              'name': _('Maximize Window'),
              'icon': 'view-fullscreen',
              'type': 'Shortcut',
              'data': '<Alt>F10',
              'angle': -1
            }
          ],
          'type': 'CustomMenu',
          'data': {},
          'angle': -1
        },
        {
          // Translators: This is an entry of the default menu.
          'name': _('Favorites'),
          'icon': 'emblem-favorite',
          'type': 'Favorites',
          'data': {},
          'angle': -1
        },
        {
          // Translators: This is an entry of the default menu.
          'name': _('Sound'),
          'icon': 'audio-speakers',
          'children': [
            {
              // Translators: This is an entry of the default menu.
              'name': _('Next Title'),
              'icon': '⏩️',
              'type': 'Shortcut',
              'data': 'AudioNext',
              'angle': 90
            },
            {
              // Translators: This is an entry of the default menu.
              'name': _('Play / Pause'),
              'icon': '⏯️',
              'type': 'Shortcut',
              'data': 'AudioPlay',
              'angle': -1
            },
            {
              // Translators: This is an entry of the default menu.
              'name': _('Mute'),
              'icon': '🔈️',
              'type': 'Shortcut',
              'data': 'AudioMute',
              'angle': -1
            },
            {
              // Translators: This is an entry of the default menu.
              'name': _('Previous Title'),
              'icon': '⏪️',
              'type': 'Shortcut',
              'data': 'AudioPrev',
              'angle': 270
            }
          ],
          'type': 'CustomMenu',
          'data': {},
          'angle': -1
        },
        {
          // Translators: This is an entry of the default menu.
          'name': _('Fly-Pie Settings'),
          'icon': 'preferences-system',
          'type': 'Command',
          'data': 'gnome-extensions prefs flypie@schneegans.github.com',
          'angle': -1
        }
      ],
      'type': 'CustomMenu',
      'data': {}
    };

    return menu;
  }
}