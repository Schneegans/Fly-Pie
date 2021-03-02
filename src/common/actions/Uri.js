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
// The Uri action opens the defined URI with the system's default application.          //
// See common/ItemRegistry.js for a description of the action's format.                 //
//////////////////////////////////////////////////////////////////////////////////////////

var action = {

  // There are two fundamental item types in Fly-Pie: Actions and Menus. Actions have an
  // onSelect() method which is called when the user selects the item, Menus can have
  // child Actions or Menus.
  class: ItemRegistry.ItemClass.ACTION,

  // This will be shown in the add-new-item-popover of the settings dialog.
  name: _('Open URI'),

  // This is also used in the add-new-item-popover.
  icon: 'applications-internet',

  // Translators: Please keep this short.
  // This is the (short) description shown in the add-new-item-popover.
  subtitle: _('Opens an URI with the default application.'),

  // This is the (long) description shown when an item of this type is selected.
  description: _(
      'When the <b>Open URI</b> action is activated, the above URI is opened with the default application. For http URLs, this will be your web browser. However, it is also possible to open other URIs such as "mailto:foo@bar.org".'),

  // Items of this type have an additional data property which can be set by the user. The
  // data value chosen by the user is passed to the createItem() method further below.
  data: {

    // The data type determines which widget is visible when an item of this type is
    // selected in the settings dialog.
    type: ItemRegistry.ItemDataType.TEXT,

    // This is shown on the left above the data widget in the settings dialog.
    name: _('URI'),

    // Translators: Please keep this short.
    // This is shown on the right above the data widget in the settings dialog.
    description: _('It will be opened with the default app.'),

    // This is be used as data for newly created items.
    default: '',
  },

  // This will be called whenever a menu is opened containing an item of this kind.
  // The data value chosen by the user will be passed to this function.
  createItem: (data) => {
    // The onSelect() function will be called when the user selects this action.
    return {
      onSelect: () => {
        try {
          Gio.AppInfo.launch_default_for_uri(data, null);
        } catch (error) {
          utils.debug('Failed to open URL: ' + error);
        }
      }
    };
  }
};
