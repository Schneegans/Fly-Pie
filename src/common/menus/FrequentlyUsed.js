//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const _ = imports.gettext.domain('flypie').gettext;

const Me                  = imports.misc.extensionUtils.getCurrentExtension();
const ItemRegistry        = Me.imports.src.common.ItemRegistry;
const ConfigWidgetFactory = Me.imports.src.common.ConfigWidgetFactory.ConfigWidgetFactory;

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
  // onSelect() method which is called when the user selects the item, Menus can have
  // child Actions or Menus.
  class: ItemRegistry.ItemClass.MENU,

  // This will be shown in the add-new-item-popover of the settings dialog.
  name: _('Frequently Used'),

  // This is also used in the add-new-item-popover.
  icon: 'flypie-menu-frequently-used-symbolic-#b59',

  // Translators: Please keep this short.
  // This is the (short) description shown in the add-new-item-popover.
  subtitle: _('Shows your frequently used applications.'),

  // This is the (long) description shown when an item of this type is selected.
  description: _(
      'The <b>Frequently Used</b> menu shows a list of frequently used applications. For efficient selections, you should limit the maximum number of shown applications to about twelve.'),

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

    const apps   = Shell.AppUsage.get_default().get_most_used().slice(0, maxNum);
    const result = {children: []};

    apps.forEach(app => {
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