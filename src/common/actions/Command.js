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
// The command actions executes a shell command when activated. This can be used to     //
// launch any application installed in the $PATH.                                       //
// See common/ItemRegistry.js for a description of the action's format.                 //
//////////////////////////////////////////////////////////////////////////////////////////

var action = {

  // There are two fundamental item types in Fly-Pie: Actions and Menus. Actions have an
  // onSelect() method which is called when the user selects the item, Menus can have
  // child Actions or Menus.
  class: ItemRegistry.ItemClass.ACTION,

  // This will be shown in the add-new-item-popover of the settings dialog.
  name: _('Launch Application'),

  // This is also used in the add-new-item-popover.
  icon: 'flypie-action-command-symbolic-#444',

  // Translators: Please keep this short.
  // This is the (short) description shown in the add-new-item-popover.
  subtitle: _('Runs any shell command.'),

  // This is the (long) description shown when an item of this type is selected.
  description: _(
      'The <b>Launch Application</b> action executes any given command. This is primarily used to open applications but may have plenty of other use cases as well.'),

  // Items of this type have an additional text configuration parameter which represents
  // the command to execute.
  config: {
    // This is used as data for newly created items of this type.
    defaultData: {command: ''},

    // This is called whenever an item of this type is selected in the menu editor. It
    // returns a Gtk.Widget which will be shown in the sidebar of the menu editor. The
    // currently configured data object will be passed as first parameter and *should* be
    // an object containing a single "command" property. To stay backwards compatible with
    // Fly-Pie 4, we have to also handle the case where the command is given as a simple
    // string value. The second parameter is a callback which is fired whenever the user
    // changes something in the widgets.
    getWidget(data, updateCallback) {
      let command = '';
      if (typeof data === 'string') {
        command = data;
      } else if (data.command != undefined) {
        command = data.command;
      }

      return ConfigWidgetFactory.createCommandWidget(
          _('Command'), _('Use the button to list installed apps.'), command,
          (command, name, icon) => {
            updateCallback({command: command}, name, icon);
          });
    }
  },

  // This will be called whenever a menu is opened containing an item of this kind.
  // The data parameter *should* be an object containing a single "command" property.
  // To stay backwards compatible with Fly-Pie 4, we have to also handle the case
  // where the command is given as a simple string value.
  createItem: (data) => {
    let command = '';
    if (typeof data === 'string') {
      command = data;
    } else if (data.command != undefined) {
      command = data.command;
    }

    // The onSelect() function will be called when the user selects this action.
    return {
      onSelect: () => {
        try {
          const ctx  = global.create_app_launch_context(0, -1);
          const item = Gio.AppInfo.create_from_commandline(
              command, null, Gio.AppInfoCreateFlags.NONE);
          item.launch([], ctx);
        } catch (error) {
          utils.debug('Failed to execute command: ' + error);
        }
      }
    };
  }
};