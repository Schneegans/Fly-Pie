//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Gio    = imports.gi.Gio;
const Config = imports.misc.config;

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
      'icon': 'flypie-symbolic-#46a',
      'shortcut': '<Primary>space',
      'centered': false,
      'id': 0,
      'children': [
        {
          // Translators: This is an entry of the default menu.
          'name': _('Sound'),
          'icon': 'flypie-multimedia-symbolic-#c86',
          'children': [
            {
              // Translators: This is an entry of the default menu.
              'name': _('Mute'),
              'icon': 'flypie-multimedia-mute-symbolic-#853',
              'type': 'Shortcut',
              'data': 'AudioMute',
              'angle': -1
            },
            {
              // Translators: This is an entry of the default menu.
              'name': _('Play / Pause'),
              'icon': 'flypie-multimedia-playpause-symbolic-#853',
              'type': 'Shortcut',
              'data': 'AudioPlay',
              'angle': -1
            },
            {
              // Translators: This is an entry of the default menu.
              'name': _('Next Title'),
              'icon': 'flypie-multimedia-next-symbolic-#853',
              'type': 'Shortcut',
              'data': 'AudioNext',
              'angle': 90
            },
            {
              // Translators: This is an entry of the default menu.
              'name': _('Previous Title'),
              'icon': 'flypie-multimedia-previous-symbolic-#853',
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
          'name': _('Favorites'),
          'icon': 'flypie-menu-favorites-symbolic-#da3',
          'type': 'Favorites',
          'data': {},
          'angle': -1
        },
        {
          // Translators: This is an entry of the default menu.
          'name': _('Maximize Window'),
          'icon': 'flypie-window-maximize-symbolic-#b68',
          'type': 'Shortcut',
          'data': '<Alt>F10',
          'angle': -1
        },
        {
          // Translators: This is an entry of the default menu.
          'name': _('Fly-Pie Settings'),
          'icon': 'flypie-menu-system-symbolic-#3ab',
          'type': 'Command',
          'data': 'gnome-extensions prefs flypie@schneegans.github.com',
          'angle': -1
        },
        {
          // Translators: This is an entry of the default menu.
          'name': _('Close Window'),
          'icon': 'flypie-window-close-symbolic-#a33',
          'type': 'Shortcut',
          'data': '<Alt>F4',
          'angle': -1
        },
        {
          // Translators: This is an entry of the default menu. I
          'name': _('Running Apps'),
          'icon': 'flypie-menu-running-apps-symbolic-#65a',
          'type': 'RunningApps',
          'data': {
            'activeWorkspaceOnly': false,
            'appGrouping': true,
            'hoverPeeking': true,
            'nameRegex': ''
          },
          'angle': -1
        }
      ],
      'type': 'CustomMenu',
      'data': {}
    };

    // The workspace switcher items are different on GNOME 3.3x and GNOME 40+ as the
    // workspace layout changed.
    const [major]      = Config.PACKAGE_VERSION.split('.');
    const shellVersion = Number.parseInt(major);
    if (shellVersion >= 40) {

      menu.children.splice(2, 0, {
        // Translators: This is an entry of the default menu under GNOME 40 and beyond.
        'name': _('Next Workspace'),
        'icon': 'flypie-go-right-symbolic-#6b5',
        'type': 'Shortcut',
        'data': {'shortcut': '<Control><Alt>Right'},
        'angle': -1
      });

      menu.children.splice(6, 0, {
        // Translators: This is an entry of the default menu under GNOME 40 and beyond.
        'name': _('Previous Workspace'),
        'icon': 'flypie-go-left-symbolic-#6b5',
        'type': 'Shortcut',
        'data': {'shortcut': '<Control><Alt>Left'},
        'angle': -1
      });

    } else {

      menu.children.splice(2, 0, {
        // Translators: This is an entry of the default menu under GNOME 3.3x only.
        'name': _('Switch Workspace'),
        'type': 'CustomMenu',
        'children': [
          {
            // Translators: This is an entry of the default menu under GNOME 3.3x only.
            'name': _('Go Up'),
            'icon': 'flypie-go-up-symbolic-#6b5',
            'type': 'Shortcut',
            'data': {'shortcut': '<Control><Alt>Up'},
            'angle': 0
          },
          {
            // Translators: This is an entry of the default menu under GNOME 3.3x only.
            'name': _('Go Down'),
            'type': 'Shortcut',
            'icon': 'flypie-go-down-symbolic-#6b5',
            'data': {'shortcut': '<Control><Alt>Down'},
            'angle': 180
          }
        ],
        'icon': 'flypie-go-updown-symbolic-#6b5',
        'angle': -1
      });

      menu.children.splice(6, 0, {
        // Translators: This is an entry of the default menu under GNOME 3.3x only.
        'name': _('Move Window'),
        'type': 'CustomMenu',
        'children': [
          {
            // Translators: This is an entry of the default menu under GNOME 3.3x only.
            'name': _('Move Window Up'),
            'type': 'Shortcut',
            'icon': 'flypie-move-up-symbolic-#6b5',
            'data': {'shortcut': '<Shift><Control><Alt>Up'},
            'angle': 0
          },
          {
            // Translators: This is an entry of the default menu under GNOME 3.3x only.
            'name': _('Move Window Down'),
            'type': 'Shortcut',
            'icon': 'flypie-move-down-symbolic-#6b5',
            'data': {'shortcut': '<Shift><Control><Alt>Down'},
            'angle': 180
          }
        ],
        'icon': 'flypie-move-updown-symbolic-#6b5',
        'angle': -1
      });
    }

    return menu;
  }
}