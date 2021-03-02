//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const {Gdk, Gtk} = imports.gi;

const _ = imports.gettext.domain('flypie').gettext;

const Me           = imports.misc.extensionUtils.getCurrentExtension();
const ItemRegistry = Me.imports.src.common.ItemRegistry;

// We import the InputManipulator optionally. When this file is included from the daemon
// side, it is available and can be used in the activation code of the action defined
// below. If this file is included via the pref.js, it will not be available. But this is
// not a problem, as the preferences will not call the createItem() methods below; they
// are merely interested in the action's name, icon and description.
let InputManipulator = undefined;

try {
  InputManipulator = new Me.imports.src.common.InputManipulator.InputManipulator();
} catch (error) {
  // Nothing to be done, we're in settings-mode.
}

//////////////////////////////////////////////////////////////////////////////////////////
// The insert-text action pastes some text to the current cursor position.              //
// See common/ItemRegistry.js for a description of the action's format.                 //
//////////////////////////////////////////////////////////////////////////////////////////

var action = {

  // There are two fundamental item types in Fly-Pie: Actions and Menus. Actions have an
  // onSelect() method which is called when the user selects the item, Menus can have
  // child Actions or Menus.
  class: ItemRegistry.ItemClass.ACTION,

  // This will be shown in the add-new-item-popover of the settings dialog.
  name: _('Insert Text'),

  // This is also used in the add-new-item-popover.
  icon: 'input-keyboard',

  // Translators: Please keep this short.
  // This is the (short) description shown in the add-new-item-popover.
  subtitle: _('Types some text automatically.'),

  // This is the (long) description shown when an item of this type is selected.
  description: _(
      'The <b>Insert Text</b> action copies the given text to the clipboard and then simulates a Ctrl+V. This can be useful if you realize that you often write the same things.'),

  // Items of this type have an additional data property which can be set by the user. The
  // data value chosen by the user is passed to the createItem() method further below.
  data: {

    // The data type determines which widget is visible when an item of this type is
    // selected in the settings dialog.
    type: ItemRegistry.ItemDataType.TEXT,

    // This is shown on the left above the data widget in the settings dialog.
    name: _('Text'),

    // Translators: Please keep this short.
    // This is shown on the right above the data widget in the settings dialog.
    description: _('This text will be inserted.'),

    // This is be used as data for newly created items.
    default: '',
  },

  // This will be called whenever a menu is opened containing an item of this kind.
  // The data value chosen by the user will be passed to this function.
  createItem: (data) => {
    // The onSelect() function will be called when the user selects this action.
    return {
      onSelect: () => {
        const clipboard = Gtk.Clipboard.get_default(Gdk.Display.get_default());
        clipboard.set_text(data, -1);
        InputManipulator.activateAccelerator('<Primary>v');
      }
    };
  }
};
