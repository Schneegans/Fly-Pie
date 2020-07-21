//////////////////////////////////////////////////////////////////////////////////////////
//   _____       _             _____ _                                                  //
//  |   __|_ _ _|_|___ ___ ___|  _  |_|___   This software may be modified and distri-  //
//  |__   | | | | |   | . |___|   __| | -_|  buted under the terms of the MIT license.  //
//  |_____|_____|_|_|_|_  |   |__|  |_|___|  See the LICENSE file for details.          //
//                    |___|                                                             //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

// This creates a default menu configuration which is used when the user has no menus
// configured.

var DefaultMenu = class DefaultMenu {

  static get() {
    let root = {
      name: 'Example Menu',
      type: 'Menu',
      icon: '🌟️',
      id: 0,
      shortcut: '<Primary>space',
      children: []
    };


    let apps = {
      name: 'Default Apps',
      icon: 'emblem-favorite',
      type: 'Submenu',
      data: '',
      angle: -1,
      children: []
    };
    root.children.push(apps);

    apps.children.push({
      name: 'Swing-Pie Settings',
      icon: 'gnome-settings',
      type: 'Command',
      data: 'gnome-extensions prefs swingpie@schneegans.github.com',
      angle: -1
    });

    root.children.push({
      name: 'Gnome-Shell',
      icon: 'gnome-foot',
      type: 'Submenu',
      data: '',
      angle: -1,
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
          angle: -1
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
          icon: 'view-grid',
          type: 'Shortcut',
          data: '<Super>a',
          angle: -1
        }
      ]
    });

    root.children.push({
      name: 'Shortcuts',
      icon: 'gnome-foot',
      type: 'Submenu',
      data: '',
      angle: -1,
      children: [
        {
          name: 'Undo',
          icon: '🔼️',
          type: 'Shortcut',
          data: '<Primary>z',
          angle: -1,
        },
      ]
    });

    root.children.push({
      name: 'Open Windows',
      icon: 'preferences-system-windows',
      type: 'RunningApps',
      data: '',
      angle: -1
    });

    root.children.push({
      name: 'Bookmarks',
      icon: 'folder',
      type: 'Bookmarks',
      data: '',
      angle: -1,
    });

    root.children.push({
      name: 'Sound',
      icon: 'multimedia-audio-player',
      type: 'Submenu',
      data: '',
      angle: -1,
      children: [
        {
          name: 'Increase Volume',
          icon: '🔊️',
          type: 'Shortcut',
          data: 'AudioRaiseVolume',
          angle: 0
        },
        {
          name: 'Mute',
          icon: '🔈️',
          type: 'Shortcut',
          data: 'AudioMute',
          angle: -1,
        },
        {
          name: 'Next Title',
          icon: '⏩️',
          type: 'Shortcut',
          data: 'AudioNext',
          angle: 90
        },
        {
          name: 'Descrease Volume',
          icon: '🔉️',
          type: 'Shortcut',
          data: 'AudioLowerVolume',
          angle: 180
        },
        {
          name: 'Play / Pause',
          icon: '⏯️',
          type: 'Shortcut',
          data: 'AudioPlay',
          angle: -1
        },
        {
          name: 'Previous Title',
          icon: '⏪️',
          type: 'Shortcut',
          data: 'AudioPrev',
          angle: 270
        }
      ]
    });

    return root;
  }
}