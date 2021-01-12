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
// Returns an item with entries for each "frequently used application", as reported by  //
// GNOME Shell.                                                                         //
// See common/ItemRegistry.js for a description of the action's format.                 //
//////////////////////////////////////////////////////////////////////////////////////////

var menu = {

  // There are two fundamental item types in Fly-Pie: Actions and Menus. Actions have an
  // activate() method which is called when the user selects the item, Menus can have
  // child Actions or Menus.
  class: ItemRegistry.ItemClass.MENU,

  // This will be shown in the add-new-item-popover of the settings dialog.
  name: _('Frequently Used'),

  // This is also used in the add-new-item-popover.
  icon: 'emblem-favorite',

  // Translators: Please keep this short.
  // This is the (short) description shown in the add-new-item-popover.
  subtitle: _('Shows your frequently used applications.'),

  // This is the (long) description shown when an item of this type is selected.
  description: _(
      'The <b>Frequently Used</b> menu shows a list of frequently used applications. For efficient selections, you should limit the maximum number of shown applications to about twelve.'),

  // Items of this type have an additional data property which can be set by the user. The
  // data value chosen by the user is passed to the createItem() method further below.
  data: {

    // The data type determines which widget is visible when an item of this type is
    // selected in the settings dialog.
    type: ItemRegistry.ItemDataType.COUNT,

    // This is shown on the left above the data widget in the settings dialog.
    name: _('Max Item Count'),

    // Translators: Please keep this short.
    // This is shown on the right above the data widget in the settings dialog.
    description: _('Limits the number of children.'),

    // This is be used as data for newly created items.
    default: '7'
  },

  // This will be called whenever a menu is opened containing an item of this kind.
  // The data value chosen by the user will be passed to this function.
  createItem: (data) => {
    const maxNum = parseInt(data);
    const apps   = Shell.AppUsage.get_default().get_most_used().slice(0, maxNum);
    const result = {children: []};

    apps.forEach(app => {
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