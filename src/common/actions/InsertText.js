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
  name: _('Insert Text'),
  icon: 'input-keyboard',
  // Translators: Please keep this short.
  subtitle: _('Types some text automatically.'),
  description: _(
      'The <b>Insert Text</b> action copies the given text to the clipboard and then simulates a Ctrl+V. This can be useful if you realize that you often write the same things.'),
  itemClass: ItemRegistry.ItemClass.ACTION,
  dataType: ItemRegistry.ItemDataType.TEXT,
  defaultData: '',
  createItem: (data) => {
    return {
      activate: () => {
        const clipboard = Gtk.Clipboard.get_default(Gdk.Display.get_default());
        clipboard.set_text(data, -1);
        InputManipulator.activateAccelerator('<Primary>v');
      }
    };
  }
};
