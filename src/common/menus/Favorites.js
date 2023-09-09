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

import * as utils from '../utils.js';
import {ItemClass} from '../ItemClass.js';

const _ = imports.gettext.domain('flypie').gettext;

// We have to import the Shell module optionally. This is because this file is included
// from both sides: From prefs.js and from extension.js. When included from prefs.js, the
// Shell module is not available. This is not a problem, as the preferences will not call
// the createItem() methods below; they are merely interested in the menu's name, icon
// and description.
const Shell = await utils.importInShellOnly('gi://Shell');

//////////////////////////////////////////////////////////////////////////////////////////
// Returns an item with entries for each "favorite application", as reported by GNOME   //
// Shell.                                                                               //
// See common/ItemRegistry.js for a description of the action's format.                 //
//////////////////////////////////////////////////////////////////////////////////////////

export function getFavoritesMenu() {
  return {

    // There are two fundamental item types in Fly-Pie: Actions and Menus. Actions have an
    // onSelect() method which is called when the user selects the item, Menus can have
    // child Actions or Menus.
    class: ItemClass.MENU,

    // This will be shown in the add-new-item-popover of the settings dialog.
    name: _('Favorites'),

    // This is also used in the add-new-item-popover.
    icon: 'flypie-menu-favorites-symbolic-#da3',

    // Translators: Please keep this short.
    // This is the (short) description shown in the add-new-item-popover.
    subtitle: _('Shows pinned applications.'),

    // This is the (long) description shown when an item of this type is selected.
    description: _(
        'The <b>Favorites</b> menu shows the applications you have pinned to GNOME Shell\'s Dash.'),

    // This will be called whenever a menu is opened containing an item of this kind.
    createItem: () => {
      const appNames = global.settings.get_strv('favorite-apps');
      const result   = {children: []};

      appNames.forEach(appName => {
        const app = Shell.AppSystem.get_default().lookup_app(appName);

        if (app) {
          result.children.push({
            name: app.get_name(),
            icon: app.get_app_info().get_icon().to_string(),
            onSelect: () => app.open_new_window(-1)
          });
        }
      });

      return result;
    }
  };
}
