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

//////////////////////////////////////////////////////////////////////////////////////////
// The D-Bus signal action does nothing. It is actually something like a dummy action.  //
// But sometimes you will just require the emission of the OnHover, OnUnhover and       //
// OnSelect D-Bus signals.                                                              //
// See common/ItemRegistry.js for a description of the action's format.                 //
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
      'The <b>D-Bus Signal</b> action does nothing on its own. But you <a href="https://github.com/Schneegans/Fly-Pie/blob/develop/docs/dbus-interface.md">can listen on the D-Bus for its activation</a>. This can be very useful in custom menus opened via the command line.'),

  // Items of this type have an additional text configuration parameter which is passed as
  // ID to the D-Bus signals.
  config: {
    // This is used as data for newly created items of this type.
    defaultData: {id: ''},

    getWidget(data, updateCallback) {
      // The data paramter *should* be an object containing a single ID property. To stay
      // backwards compatible with Fly-Pie 4, we have to also handle the case where the ID
      // is given as a simple string value.
      let id = '';
      if (typeof data === 'string') {
        id = data;
      } else if (data.id != undefined) {
        id = data.id;
      }

      return ConfigWidgetFactory.createTextWidget(
          _('ID'), _('This will be passed to the D-Bus signal.'), id, (id) => {
            updateCallback({id: id});
          });
    }
  },

  // This will be called whenever a menu is opened containing an item of this kind.
  // The data paramter *should* be an object containing a single ID property. To stay
  // backwards compatible with Fly-Pie 4, we have to also handle the case where the ID is
  // given as a simple string value.
  createItem: (data) => {
    let id = '';
    if (typeof data === 'string') {
      id = data;
    } else if (data.id != undefined) {
      id = data.id;
    }

    return {id: id, onSelect: () => {}};
  }
};