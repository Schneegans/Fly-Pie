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

const Me                  = imports.misc.extensionUtils.getCurrentExtension();
const utils               = Me.imports.src.common.utils;
const ItemRegistry        = Me.imports.src.common.ItemRegistry;
const ConfigWidgetFactory = Me.imports.src.common.ConfigWidgetFactory.ConfigWidgetFactory;

//////////////////////////////////////////////////////////////////////////////////////////
// Returns an item with entries for each recently used file, as reported by             //
// Gtk.RecentManager.                                                                   //
// See common/ItemRegistry.js for a description of the action's format.                 //
//////////////////////////////////////////////////////////////////////////////////////////

var menu = {

  // There are two fundamental item types in Fly-Pie: Actions and Menus. Actions have an
  // onSelect() method which is called when the user selects the item, Menus can have
  // child Actions or Menus.
  class: ItemRegistry.ItemClass.MENU,

  // This will be shown in the add-new-item-popover of the settings dialog.
  name: _('Recent Files'),

  // This is also used in the add-new-item-popover.
  icon: 'flypie-menu-recent-files-symbolic-#67b',

  // Translators: Please keep this short.
  // This is the (short) description shown in the add-new-item-popover.
  subtitle: _('Shows your recently used files.'),

  // This is the (long) description shown when an item of this type is selected.
  description: _(
      'The <b>Recent Files</b> menu shows a list of recently used files. For efficient selections, you should limit the maximum number of shown files to about twelve.'),

  // Items of this type have an additional count configuration parameter which is the
  // maximum number of items to display.
  config: {
    // This is used as data for newly created items of this type.
    defaultData: {maxNum: 7},

    // This is called whenever an item of this type is selected in the menu editor. It
    // returns a Gtk.Widget which will be shown in the sidebar of the menu editor. The
    // currently configured data object will be passed as first parameter and *should* be
    // an object containing a single "maxNum" property. To stay backwards compatible with
    // Fly-Pie 4, we have to also handle the case where the number is given as a simple
    // string value. The second parameter is a callback which is fired whenever the user
    // changes something in the widgets.
    getWidget(data, updateCallback) {
      let maxNum = 7;
      if (typeof data === 'string') {
        maxNum = parseInt(data);
      } else if (data.maxNum != undefined) {
        maxNum = data.maxNum;
      }

      return ConfigWidgetFactory.createCountWidget(
          _('Max Item Count'), _('Limits the number of children.'), 1, 20, 1, maxNum,
          (value) => {
            updateCallback({maxNum: value});
          });
    }
  },

  // This will be called whenever a menu is opened containing an item of this kind.
  // The data parameter *should* be an object containing a single "maxNum" property. To
  // stay backwards compatible with Fly-Pie 4, we have to also handle the case where
  // the maxNum is given as a simple string value.
  createItem: (data) => {
    let maxNum = 7;
    if (typeof data === 'string') {
      maxNum = parseInt(data);
    } else if (data.maxNum != undefined) {
      maxNum = data.maxNum;
    }

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
          onSelect: () => {
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