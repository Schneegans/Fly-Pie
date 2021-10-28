//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const {Gtk, GLib} = imports.gi;
const ByteArray   = imports.byteArray;

const _ = imports.gettext.domain('flypie').gettext;

const Me                  = imports.misc.extensionUtils.getCurrentExtension();
const utils               = Me.imports.src.common.utils;
const ItemRegistry        = Me.imports.src.common.ItemRegistry;
const ConfigWidgetFactory = Me.imports.src.common.ConfigWidgetFactory.ConfigWidgetFactory;

// We have to import the ClipboardManager, InputManipulator, and Meta modules optionally.
// This is because this file is included from both sides: From prefs.js and from
// extension.js. When included from prefs.js, these are not available. This is not a
// problem, as the preferences will not call the createItem() methods below; they are
// merely interested in the menu's name, icon and description.
let ClipboardManager = undefined;

try {
  ClipboardManager = Me.imports.src.extension.ClipboardManager.ClipboardManager;
} catch (error) {
  // Nothing to be done, we're in settings-mode.
}

//////////////////////////////////////////////////////////////////////////////////////////
// Returns a menu item with entries for the last things copied to the clipboard.        //
// Selecting the entries pastes them by simulating Ctrl+V. For now, it supports vector  //
// and raster images, URLs and plain text.                                              //
// To keep track of the last copied things, the ClipboardManager class is used. Menus   //
// in Fly-Pie are very volatile, they only exist while they are visible on screen. A    //
// user could open a custom menu over the D-Bus API containing a Clipboard menu.        //
// Therefore we always have to keep track of the last copied things, even if we usually //
// do not require them.                                                                 //
// See common/ItemRegistry.js for a description of the action's format.                 //
//////////////////////////////////////////////////////////////////////////////////////////

var menu = {

  // There are two fundamental item types in Fly-Pie: Actions and Menus. Actions have an
  // onSelect() method which is called when the user selects the item, Menus can have
  // child Actions or Menus.
  class: ItemRegistry.ItemClass.MENU,

  // This will be shown in the add-new-item-popover of the settings dialog.
  name: _('Clipboard'),

  // This is also used in the add-new-item-popover.
  icon: 'flypie-menu-clipboard-symbolic-#751',

  // Translators: Please keep this short.
  // This is the (short) description shown in the add-new-item-popover.
  subtitle: _('Shows recently copied things.'),

  // This is the (long) description shown when an item of this type is selected.
  description: _('The <b>Clipboard</b> menu shows a list of copied items.'),

  // Items of this type have an additional count configuration parameter which is the
  // maximum number of items to display.
  config: {
    // This is used as data for newly created items of this type.
    defaultData: {maxNum: 7, firstAngle: -1},

    // This is called whenever an item of this type is selected in the menu editor. It
    // returns a Gtk.Widget which will be shown in the sidebar of the menu editor. The
    // currently configured data object will be passed as first parameter and *should* be
    // an object like the "defaultData" above. The second parameter is a callback which is
    // fired whenever the user changes something in the widgets.
    getWidget(data, updateCallback) {
      // Use default data for undefined properties.
      data = {...this.defaultData, ...data};

      const box = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL});

      const countBox = ConfigWidgetFactory.createConfigWidgetCaption(
          _('Max Item Count'), _('Limits the number of children.'));
      const countSpinButton = Gtk.SpinButton.new_with_range(1, 20, 1);
      countSpinButton.value = data.maxNum;
      utils.boxAppend(countBox, countSpinButton);
      utils.boxAppend(box, countBox);

      const angleBox = ConfigWidgetFactory.createConfigWidgetCaption(
          _('First Child Angle'), _('Direction of the most recent item.'));
      const angleSpinButton = Gtk.SpinButton.new_with_range(-1, 359, 1);
      angleSpinButton.value = data.firstAngle;
      utils.boxAppend(angleBox, angleSpinButton);
      utils.boxAppend(box, angleBox);

      // This is called whenever one of the widgets is modified.
      const _updateData = () => {
        updateCallback({
          maxNum: countSpinButton.value,
          firstAngle: angleSpinButton.value,
        });
      };

      countSpinButton.connect('notify::value', () => _updateData());
      angleSpinButton.connect('notify::value', () => _updateData());

      return box;
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

    const result = {children: []};

    const items = ClipboardManager.getInstance().getItems();

    for (let i = 0; i < items.length && i < maxNum; i++) {
      const item = items[i];
      let child  = null;

      if (item.type === 'text/plain' || item.type == 'text/plain;charset=utf-8') {

        const data = ByteArray.toString(ByteArray.fromGBytes(item.data));
        let icon   = data.substring(0, 8) + (data.length > 8 ? '…' : '');
        const name = data.substring(0, 30) + (data.length > 30 ? '…' : '');

        child = {icon: icon, name: name};

      } else if (item.type === 'text/uri-list') {

        const data   = ByteArray.toString(ByteArray.fromGBytes(item.data));
        const uris   = data.split(/\r?\n/);
        const config = ItemRegistry.ItemRegistry.createActionConfig(uris[0]);

        child = {icon: config.icon, name: config.name};

      } else if (item.type === 'image/svg+xml') {

        const icon = 'data:image/svg+xml;base64,' +
            GLib.base64_encode(ByteArray.fromGBytes(item.data));
        child = {icon: icon, name: _('Vector Image')};

      } else if (item.type === 'image/png') {

        const icon = 'data:image/png;base64,' +
            GLib.base64_encode(ByteArray.fromGBytes(item.data));
        child = {icon: icon, name: _('Raster Image')};
      }

      if (child) {
        child.onSelect = () => ClipboardManager.getInstance().pasteItem(item);
        result.children.push(child);
      }
    }

    return result;
  }
};