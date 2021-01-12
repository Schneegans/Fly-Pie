//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Gio = imports.gi.Gio;

const _ = imports.gettext.domain('flypie').gettext;

const Me           = imports.misc.extensionUtils.getCurrentExtension();
const utils        = Me.imports.src.common.utils;
const ItemRegistry = Me.imports.src.common.ItemRegistry;

//////////////////////////////////////////////////////////////////////////////////////////
// The command actions executes a shell command when activated. This can be used to     //
// launch any application installed in the $PATH.                                       //
// See common/ItemRegistry.js for a description of the action's format.                 //
//////////////////////////////////////////////////////////////////////////////////////////

var action = {

  // There are two fundamental item types in Fly-Pie: Actions and Menus. Actions have an
  // activate() method which is called when the user selects the item, Menus can have
  // child Actions or Menus.
  class: ItemRegistry.ItemClass.ACTION,

  // This will be shown in the add-new-item-popover of the settings dialog.
  name: _('Launch Application'),

  // This is also used in the add-new-item-popover.
  icon: 'utilities-terminal',

  // Translators: Please keep this short.
  // This is the (short) description shown in the add-new-item-popover.
  subtitle: _('Runs any shell command.'),

  // This is the (long) description shown when an item of this type is selected.
  description: _(
      'The <b>Launch Application</b> action executes any given command. This is primarily used to open applications but may have plenty of other use cases as well.'),

  // Items of this type have an additional data property which can be set by the user. The
  // data value chosen by the user is passed to the createItem() method further below.
  data: {

    // The data type determines which widget is visible when an item of this type is
    // selected in the settings dialog.
    type: ItemRegistry.ItemDataType.COMMAND,

    // This is shown on the left above the data widget in the settings dialog.
    name: _('Command'),

    // Translators: Please keep this short.
    // This is shown on the right above the data widget in the settings dialog.
    description: _('Use the button to list installed apps!'),

    // This is be used as data for newly created items.
    default: '',
  },

  // This will be called whenever a menu is opened containing an item of this kind.
  // The data value chosen by the user will be passed to this function.
  createItem: (data) => {
    // The activate() function will be called when the user selects this action.
    return {
      activate: () => {
        try {
          const ctx  = global.create_app_launch_context(0, -1);
          const item = Gio.AppInfo.create_from_commandline(
              data, null, Gio.AppInfoCreateFlags.NONE);
          item.launch([], ctx);
        } catch (error) {
          utils.debug('Failed to execute command: ' + error);
        }
      }
    };
  }
};