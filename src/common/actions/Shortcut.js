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

// We have to import the InputManipulator optionally. This is because this file is
// included from both sides: From prefs.js and from extension.js. When included from
// prefs.js, the InputManipulator is not available. This is not a problem, as the
// preferences will not call the createItem() methods below; they are merely interested in
// the menu's name, icon and description.
let InputManipulator = undefined;

try {
  InputManipulator = new Me.imports.src.common.InputManipulator.InputManipulator();
} catch (error) {
  // Nothing to be done, we're in settings-mode.
}

//////////////////////////////////////////////////////////////////////////////////////////
// The shortcut action simulates the pressing of a hotkey when activated.               //
// See common/ItemRegistry.js for a description of the action's format.                 //
//////////////////////////////////////////////////////////////////////////////////////////

var action = {

  // There are two fundamental item types in Fly-Pie: Actions and Menus. Actions have an
  // onSelect() method which is called when the user selects the item, Menus can have
  // child Actions or Menus.
  class: ItemRegistry.ItemClass.ACTION,

  // This will be shown in the add-new-item-popover of the settings dialog.
  name: _('Activate Shortcut'),

  // This is also used in the add-new-item-popover.
  icon: 'flypie-action-shortcut-symbolic-#c73',

  // Translators: Please keep this short.
  // This is the (short) description shown in the add-new-item-popover.
  subtitle: _('Simulates a key combination.'),

  // This is the (long) description shown when an item of this type is selected.
  description: _(
      'The <b>Activate Shortcut</b> action simulates a key combination when activated. For example, this can be used to switch virtual desktops, control multimedia playback or to undo / redo operations.'),

  // Items of this type have an additional configuration parameter which represents
  // the shortcut to simulate.
  config: {
    // This is used as data for newly created items of this type.
    defaultData: {shortcut: ''},

    // This is called whenever an item of this type is selected in the menu editor. It
    // returns a Gtk.Widget which will be shown in the sidebar of the menu editor. The
    // currently configured data object will be passed as first parameter and *should* be
    // an object containing a single "shortcut" property. To stay backwards compatible
    // with Fly-Pie 4, we have to also handle the case where the shortcut is given as a
    // simple string value. The second parameter is a callback which is fired whenever the
    // user changes something in the widgets.
    getWidget(data, updateCallback) {
      let shortcut = '';
      if (typeof data === 'string') {
        shortcut = data;
      } else if (data.shortcut != undefined) {
        shortcut = data.shortcut;
      }

      return ConfigWidgetFactory.createShortcutWidget(
          _('Shortcut'), _('This shortcut will be simulated.'), shortcut, (shortcut) => {
            updateCallback({shortcut: shortcut});
          });
    }
  },

  // This will be called whenever a menu is opened containing an item of this kind.
  // The data parameter *should* be an object containing a single "shortcut" property.
  // To stay backwards compatible with Fly-Pie 4, we have to also handle the case
  // where the shortcut is given as a simple string value.
  createItem: (data) => {
    let shortcut = '';
    if (typeof data === 'string') {
      shortcut = data;
    } else if (data.shortcut != undefined) {
      shortcut = data.shortcut;
    }

    // The onSelect() function will be called when the user selects this action.
    return {onSelect: () => InputManipulator.activateAccelerator(shortcut)};
  }
};
