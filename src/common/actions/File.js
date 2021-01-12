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
// The file action is very similar to the Url action, but only works for files.         //
// But it's a bit more intuitive as the leading file:// is not required.                //
// See common/ItemRegistry.js for a description of the action's format.                 //
//////////////////////////////////////////////////////////////////////////////////////////

var action = {

  // There are two fundamental item types in Fly-Pie: Actions and Menus. Actions have an
  // activate() method which is called when the user selects the item, Menus can have
  // child Actions or Menus.
  class: ItemRegistry.ItemClass.ACTION,

  // This will be shown in the add-new-item-popover of the settings dialog.
  name: _('Open File'),

  // This is also used in the add-new-item-popover.
  icon: 'text-x-generic',

  // Translators: Please keep this short.
  // This is the (short) description shown in the add-new-item-popover.
  subtitle: _('Opens a file with the default application.'),

  // This is the (long) description shown when an item of this type is selected.
  description: _(
      'The <b>Open File</b> action will open the file specified above with your system\'s default application.'),

  // Items of this type have an additional data property which can be set by the user. The
  // data value chosen by the user is passed to the createItem() method further below.
  data: {

    // The data type determines which widget is visible when an item of this type is
    // selected in the settings dialog.
    type: ItemRegistry.ItemDataType.FILE,

    // This is shown on the left above the data widget in the settings dialog.
    name: _('File'),

    // Translators: Please keep this short.
    // This is shown on the right above the data widget in the settings dialog.
    description: _('It will be opened with the default app.'),

    // This is be used as data for newly created items.
    default: ''
  },

  // This will be called whenever a menu is opened containing an item of this kind.
  // The data value chosen by the user will be passed to this function.
  createItem: (data) => {
    // The activate() function will be called when the user selects this action.
    return {
      activate: () => {
        try {
          Gio.AppInfo.launch_default_for_uri('file://' + data, null);
        } catch (error) {
          utils.debug('Failed to open file: ' + error);
        }
      }
    };
  }
};
