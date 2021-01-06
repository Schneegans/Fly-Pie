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
  name: _('Recent Files'),
  icon: 'document-open-recent',
  // Translators: Please keep this short.
  subtitle: _('Shows your recently used files.'),
  description: _(
      'The <b>Recent Files</b> menu shows a list of recently used files. For efficient selections, you should limit the maximum number of shown files to about twelve.'),
  itemClass: ItemRegistry.ItemClass.MENU,
  dataType: ItemRegistry.ItemDataType.COUNT,
  defaultData: '7',
  createItem: (data) => {
    const maxNum      = parseInt(data);
    const recentFiles = Gtk.RecentManager.get_default().get_items().slice(0, maxNum);
    const result      = {children: []};

    recentFiles.forEach(recentFile => {
      if (recentFile.exists()) {
        result.children.push({
          name: recentFile.get_display_name(),
          icon: recentFile.get_gicon().to_string(),
          activate: () => {
            const ctx = global.create_app_launch_context(0, -1);

            try {
              Gio.AppInfo.launch_default_for_uri(recentFile.get_uri(), ctx);
            } catch (error) {
              utils.debug('Failed to open URI: ' + error);
            }
          }
        });
      }
    });

    return result;
  }
};