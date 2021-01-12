//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const {Gio, Gtk} = imports.gi;

const _ = imports.gettext.domain('flypie').gettext;

const Me           = imports.misc.extensionUtils.getCurrentExtension();
const utils        = Me.imports.src.common.utils;
const ItemRegistry = Me.imports.src.common.ItemRegistry;

//////////////////////////////////////////////////////////////////////////////////////////
// Returns an item with entries for each recently used file, as reported by             //
// Gtk.RecentManager.                                                                   //
// See common/ItemRegistry.js for a description of the action's format.                 //
//////////////////////////////////////////////////////////////////////////////////////////

var menu = {

  // There are two fundamental item types in Fly-Pie: Actions and Menus. Actions have an
  // activate() method which is called when the user selects the item, Menus can have
  // child Actions or Menus.
  class: ItemRegistry.ItemClass.MENU,

  // This will be shown in the add-new-item-popover of the settings dialog.
  name: _('Recent Files'),

  // This is also used in the add-new-item-popover.
  icon: 'document-open-recent',

  // Translators: Please keep this short.
  // This is the (short) description shown in the add-new-item-popover.
  subtitle: _('Shows your recently used files.'),

  // This is the (long) description shown when an item of this type is selected.
  description: _(
      'The <b>Recent Files</b> menu shows a list of recently used files. For efficient selections, you should limit the maximum number of shown files to about twelve.'),

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
    const maxNum      = parseInt(data);
    const recentFiles = Gtk.RecentManager.get_default().get_items();
    const num         = recentFiles.length;
    const result      = {children: []};

    for (let i = 0; i < num; i++) {
      if (result.children.length >= maxNum) {
        break;
      }

      if (recentFiles[i].exists()) {
        result.children.push({
          name: recentFiles[i].get_display_name(),
          icon: recentFiles[i].get_gicon().to_string(),
          activate: () => {
            const ctx = global.create_app_launch_context(0, -1);

            try {
              Gio.AppInfo.launch_default_for_uri(recentFiles[i].get_uri(), ctx);
            } catch (error) {
              utils.debug('Failed to open URI: ' + error);
            }
          }
        });
      }
    }

    return result;
  }
};