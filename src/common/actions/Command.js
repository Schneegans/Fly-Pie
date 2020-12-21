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

const Me    = imports.misc.extensionUtils.getCurrentExtension();
const utils = Me.imports.src.common.utils;
const Enums = Me.imports.src.common.Enums;

//////////////////////////////////////////////////////////////////////////////////////////
// The command actions executes a shell command when activated. This can be used to     //
// launch any application installed in the $PATH.                                       //
// See common/ItemRegistry.js for a description of the action's format.                 //
//////////////////////////////////////////////////////////////////////////////////////////

var action = {
  name: _('Launch Application'),
  icon: 'utilities-terminal',
  // Translators: Please keep this short.
  subtitle: _('Runs any shell command.'),
  description: _(
      'The <b>Launch Application</b> action executes any given command. This is primarily used to open applications but may have plenty of other use cases as well.'),
  itemClass: Enums.ItemClass.ACTION,
  dataType: Enums.ItemDataType.COMMAND,
  defaultData: '',
  createItem: (data) => {
    return {
      activate: () => {
        try {
          const ctx  = global.create_app_launch_context(0, -1);
          const item = Gio.AppInfo.create_from_commandline(
              data, null, Gio.AppInfoCreateFlags.NONE);
          item.launch([], ctx);
        } catch (error) {
          utils.debug('Failed to execute command: ' + error);
        }
      }
    };
  }
};