//////////////////////////////////////////////////////////////////////////////////////////
//                               ___            _     ___                               //
//                               |   |   \/    | ) |  |                                 //
//                           O-  |-  |   |  -  |   |  |-  -O                            //
//                               |   |_  |     |   |  |_                                //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

// SPDX-FileCopyrightText: Simon Schneegans <code@simonschneegans.de>
// SPDX-License-Identifier: MIT

'use strict';

import GLib from 'gi://GLib';

import * as utils from '../utils.js';
import {ItemClass} from '../ItemClass.js';
import {ItemRegistry} from '../ItemRegistry.js';

const Gtk                 = await utils.importInPrefsOnly('gi://Gtk');
const ConfigWidgetFactory = await utils.importInPrefsOnly('./ConfigWidgetFactory.js');
const _                   = await utils.importGettext();

// We import the ClipboardManager optionally. When this file is included from the daemon
// side, it is available and can be used in the activation code of the action defined
// below. If this file is included via the pref.js, they will not be available. But this
// is not a problem, as the preferences will not call the createItem() methods below; they
// are merely interested in the action's name, icon and description.
const ClipboardManager =
    await utils.importInShellOnly('../extension/ClipboardManager.js');

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

export function getClipboardMenu() {
  // This is used as data for newly created items of this type.
  const defaultData = {maxNum: 7, firstAngle: -1};

  return {

    // There are two fundamental item types in Fly-Pie: Actions and Menus. Actions have an
    // onSelect() method which is called when the user selects the item, Menus can have
    // child Actions or Menus.
    class: ItemClass.MENU,

    // This will be shown in the add-new-item-popover of the settings dialog.
    name: _('Clipboard'),

    // This is also used in the add-new-item-popover.
    icon: 'flypie-menu-clipboard-symbolic-#751',

    // Translators: Please keep this short.
    // This is the (short) description shown in the add-new-item-popover.
    subtitle: _('Shows recently copied things.'),

    // This is the (long) description shown when an item of this type is selected.
    description: _('The <b>Clipboard</b> menu shows a list of recently copied things.'),

    // Items of this type have an additional count configuration parameter which is the
    // maximum number of items to display.
    config: {
      defaultData: defaultData,

      // This is called whenever an item of this type is selected in the menu editor. It
      // returns a Gtk.Widget which will be shown in the sidebar of the menu editor. The
      // currently configured data object will be passed as first parameter and *should*
      // be an object like the "defaultData" above. The second parameter is a callback
      // which has to be fired whenever the user changes something in the widgets.
      getWidget(data, updateCallback) {
        // Use default data for undefined properties.
        data = {...defaultData, ...data};

        const box = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL});

        // Add a spin button for configuring the number of displayed items.
        const countBox = ConfigWidgetFactory.createConfigWidgetCaption(
            _('Max Item Count'), _('Limits the number of children.'));
        const countSpinButton = Gtk.SpinButton.new_with_range(1, 20, 1);
        countSpinButton.value = data.maxNum;
        countBox.append(countSpinButton);
        box.append(countBox);

        // Add a spin button for configuring the fixed angle of the most recently copied
        // item.
        const angleBox = ConfigWidgetFactory.createConfigWidgetCaption(
            _('First Child Angle'), _('Direction of the most recent item.'));
        const angleSpinButton = Gtk.SpinButton.new_with_range(-1, 359, 1);
        angleSpinButton.value = data.firstAngle;
        angleBox.append(angleSpinButton);
        box.append(angleBox);

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

    // This will be called whenever a menu is opened containing an item of this kind. We
    // have to create a list of items, one for each recently copied item.
    createItem: (data) => {
      // Use default data for undefined properties.
      data = {...defaultData, ...data};

      // This menu configuration will be filled with children and returned at the end.
      const result = {children: []};

      // Get a list of recently copied things from the ClipboardManager.
      const clipboardManager = ClipboardManager.getInstance();
      const items            = clipboardManager.getItems();

      // The ClipboardManager stores the copied things in several hard-coded mime type
      // formats (see the documentation of that class for more details). Based on the mime
      // type, we create different child items.
      for (let i = 0; i < items.length && i < data.maxNum; i++) {
        const item = items[i];
        let child  = null;

        // If the copied data was text, we create an item which shows a small portion of
        // the text as icon and a longer portion as name.
        if (item.type === 'text/plain' || item.type == 'text/plain;charset=utf-8') {

          const text = new TextDecoder().decode(item.data.get_data());

          child = {
            icon: text.substring(0, 8) + (text.length > 8 ? '…' : ''),
            name: text.substring(0, 30) + (text.length > 30 ? '…' : '')
          };
        }
        // If the copied item contains a list of copied files, we display an appropriate
        // icon and name for the first file.
        else if (item.type === 'x-special/gnome-copied-files') {

          const data   = new TextDecoder().decode(item.data.get_data());
          const lines  = data.split(/\r?\n/);
          const file   = lines[1];  // The first item contains the action (cut, copy).
          const config = ItemRegistry.createActionConfig(file);

          child = {icon: config.icon, name: config.name};
        }
        // If the copied item contains a vector image, we encode the data as base64 image
        // so that we can actually preview it as icon.
        else if (item.type === 'image/svg+xml') {

          child = {
            icon: 'data:image/svg+xml;base64,' +
                GLib.base64_encode(new GLib.Bytes(item.data).unref_to_array()),
            // Translators: This is shown as item name in the clipboard menu when the user
            // copied a vector image.
            name: _('Vector Image')
          };
        }
        // If the copied item contains a raster image, we encode the data as base64 image
        // so that we can actually preview it as icon.
        else if (item.type === 'image/png') {

          child = {
            icon: 'data:image/png;base64,' +
                GLib.base64_encode(new GLib.Bytes(item.data).unref_to_array()),
            // Translators: This is shown as item name in the clipboard menu when the user
            // copied a raster image.
            name: _('Raster Image')
          };
        }
        // In all other cases we log an error.
        else {
          utils.debug(`Failed to add clipboard item: Unsupported mime type "${
              item.type}" given!`);
        }

        // If we successfully created an item, we add it to the result children list and
        // assign an "onSelect" callback which will paster the contained data.
        if (child) {
          child.onSelect = () => clipboardManager.pasteItem(item);
          result.children.push(child);

          // Assign the configured fixed angle for the first child.
          if (result.children.length == 1) {
            result.children[0].angle = data.firstAngle;
          }
        }
      }

      return result;
    }
  };
}