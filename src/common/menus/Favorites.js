//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const _ = imports.gettext.domain('flypie').gettext;

const Me           = imports.misc.extensionUtils.getCurrentExtension();
const ItemRegistry = Me.imports.src.common.ItemRegistry;

// We have to import the Shell module optionally. This is because this file is included
// from both sides: From prefs.js and from extension.js. When included from prefs.js, the
// Shell module is not available. This is not a problem, as the preferences will not call
// the createItem() methods below; they are merely interested in the menu's name, icon
// and description.
let Shell = undefined;

try {
  Shell = imports.gi.Shell;
} catch (error) {
  // Nothing to be done, we're in settings-mode.
}

//////////////////////////////////////////////////////////////////////////////////////////
// Returns an item with entries for each "favorite application", as reported by GNOME   //
// Shell.                                                                               //
// See common/ItemRegistry.js for a description of the action's format.                 //
//////////////////////////////////////////////////////////////////////////////////////////

var menu = {

  // There are two fundamental item types in Fly-Pie: Actions and Menus. Actions have an
  // onSelect() method which is called when the user selects the item, Menus can have
  // child Actions or Menus.
  class: ItemRegistry.ItemClass.MENU,

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
