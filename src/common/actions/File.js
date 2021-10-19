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

const Me                  = imports.misc.extensionUtils.getCurrentExtension();
const utils               = Me.imports.src.common.utils;
const ItemRegistry        = Me.imports.src.common.ItemRegistry;
const ConfigWidgetFactory = Me.imports.src.common.ConfigWidgetFactory.ConfigWidgetFactory;

//////////////////////////////////////////////////////////////////////////////////////////
// The file action is very similar to the Url action, but only works for files.         //
// But it's a bit more intuitive as the leading file:// is not required.                //
// See common/ItemRegistry.js for a description of the action's format.                 //
//////////////////////////////////////////////////////////////////////////////////////////

var action = {

  // There are two fundamental item types in Fly-Pie: Actions and Menus. Actions have an
  // onSelect() method which is called when the user selects the item, Menus can have
  // child Actions or Menus.
  class: ItemRegistry.ItemClass.ACTION,

  // This will be shown in the add-new-item-popover of the settings dialog.
  name: _('Open File'),

  // This is also used in the add-new-item-popover.
  icon: 'flypie-action-file-symbolic-#8a3',

  // Translators: Please keep this short.
  // This is the (short) description shown in the add-new-item-popover.
  subtitle: _('Opens a file with the default application.'),

  // This is the (long) description shown when an item of this type is selected.
  description: _(
      'The <b>Open File</b> action will open the file specified above with your system\'s default application.'),

  // Items of this type have an additional text configuration parameter which represents
  // the file path to open.
  config: {
    // This is used as data for newly created items of this type.
    defaultData: {file: ''},

    // This is called whenever an item of this type is selected in the menu editor. It
    // returns a Gtk.Widget which will be shown in the sidebar of the menu editor. The
    // currently configured data object will be passed as first parameter and *should* be
    // an object containing a single "file" property. To stay backwards compatible with
    // Fly-Pie 4, we have to also handle the case where the file is given as a simple
    // string value. The second parameter is a callback which is fired whenever the user
    // changes something in the widgets.
    getWidget(data, updateCallback) {
      let file = '';
      if (typeof data === 'string') {
        file = data;
      } else if (data.file != undefined) {
        file = data.file;
      }

      return ConfigWidgetFactory.createFileWidget(
          _('File'), _('It will be opened with the default app.'), file,
          (file, name, icon) => {
            updateCallback({file: file}, name, icon);
          });
    }
  },

  // This will be called whenever a menu is opened containing an item of this kind.
  // The data parameter *should* be an object containing a single "file" property.
  // To stay backwards compatible with Fly-Pie 4, we have to also handle the case
  // where the file is given as a simple string value.
  createItem: (data) => {
    let file = '';
    if (typeof data === 'string') {
      file = data;
    } else if (data.file != undefined) {
      file = data.file;
    }

    // The onSelect() function will be called when the user selects this action.
    return {
      onSelect: () => {
        try {
          Gio.AppInfo.launch_default_for_uri('file://' + file, null);
        } catch (error) {
          utils.debug('Failed to open file: ' + error);
        }
      }
    };
  }
};
