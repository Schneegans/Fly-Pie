//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const _ = imports.gettext.domain('flypie').gettext;

const Me    = imports.misc.extensionUtils.getCurrentExtension();
const Enums = Me.imports.src.common.Enums;

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
// The shortcut action simulates the pressing of a hotkey when activated.               //
// See common/ItemRegistry.js for a description of the action's format.                 //
//////////////////////////////////////////////////////////////////////////////////////////

var action = {
  name: _('Activate Shortcut'),
  icon: 'preferences-desktop-keyboard-shortcuts',
  // Translators: Please keep this short.
  subtitle: _('Simulates a key combination.'),
  description: _(
      'The <b>Activate Shortcut</b> action simulates a key combination when activated. For example, this can be used to switch virtual desktops, control multimedia playback or to undo / redo operations.'),
  itemClass: Enums.ItemClass.ACTION,
  dataType: Enums.ItemDataType.SHORTCUT,
  defaultData: '',
  createItem: (data) => {
    return {activate: () => InputManipulator.activateAccelerator(data)};
  }
};
