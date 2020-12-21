//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const _ = imports.gettext.domain('flypie').gettext;

const Me    = imports.misc.extensionUtils.getCurrentExtension();
const Enums = Me.imports.src.common.Enums;

// We import Shell optionally. When this file is included from the daemon side, it is
// available and can be used in the activation code of the action defined below. If this
// file is included via the pref.js, it will not be available. But this is not a problem,
// as the preferences will not call the createItem() methods below; they are merely
// interested in the action's name, icon and description.
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
  name: _('Favorites'),
  icon: 'starred',
  // Translators: Please keep this short.
  subtitle: _('Shows pinned applications.'),
  description: _(
      'The <b>Favorites</b> menu shows the applications you have pinned to Gnome Shell\'s Dash.'),
  itemClass: Enums.ItemClass.MENU,
  dataType: Enums.ItemDataType.NONE,
  defaultData: '',
  createItem: () => {
    const appNames = global.settings.get_strv('favorite-apps');
    const result   = {children: []};

    appNames.forEach(appName => {
      const app = Shell.AppSystem.get_default().lookup_app(appName);

      if (app) {
        result.children.push({
          name: app.get_name(),
          icon: app.get_app_info().get_icon().to_string(),
          activate: () => app.open_new_window(-1)
        });
      }
    });

    return result;
  }
};
