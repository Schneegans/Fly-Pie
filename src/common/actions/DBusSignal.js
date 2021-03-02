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

//////////////////////////////////////////////////////////////////////////////////////////
// The D-Bus signal action does nothing. It is actually something like a dummy action.  //
// But sometimes you will just require the emission of the OnHover and OnSelect D-Bus   //
// signals. See common/ItemRegistry.js for a description of the action's format.        //
//////////////////////////////////////////////////////////////////////////////////////////

var action = {

  // There are two fundamental item types in Fly-Pie: Actions and Menus. Actions have an
  // onSelect() method which is called when the user selects the item, Menus can have
  // child Actions or Menus.
  class: ItemRegistry.ItemClass.ACTION,

  // This will be shown in the add-new-item-popover of the settings dialog.
  name: _('D-Bus Signal'),

  // This is also used in the add-new-item-popover.
  icon: 'application-x-addon',

  // Translators: Please keep this short.
  // This is the (short) description shown in the add-new-item-popover.
  subtitle: _('Emits a D-Bus signal.'),

  // This is the (long) description shown when an item of this type is selected.
  description: _(
      'The <b>D-Bus Signal</b> action does nothing on its own. But you <a href="https://github.com/Schneegans/Fly-Pie#fly-pies-d-bus-interface">can listen on the D-Bus for its activation</a>. This can be very useful in custom menus opened via the command line.'),

  // Items of this type have an additional data property which can be set by the user. The
  // data value chosen by the user is passed to the createItem() method further below.
  data: {

    // The data type determines which widget is visible when an item of this type is
    // selected in the settings dialog.
    type: ItemRegistry.ItemDataType.TEXT,

    // This is shown on the left above the data widget in the settings dialog.
    name: _('ID'),

    // Translators: Please keep this short.
    // This is shown on the right above the data widget in the settings dialog.
    description: _('This will be passed to the D-Bus signal.'),

    // This is be used as data for newly created items.
    default: '',
  },

  // This will be called whenever a menu is opened containing an item of this kind.
  // The data value chosen by the user will be passed to this function.
  createItem: (data) => {
    return {id: data, onSelect: () => {}};
  }
};