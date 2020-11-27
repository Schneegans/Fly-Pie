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
const utils = Me.imports.common.utils;
const Enums = Me.imports.common.Enums;

//////////////////////////////////////////////////////////////////////////////////////////
// The file action is very similar to the Url action, but only works for files.         //
// But it's a bit more intuitive as the leading file:// is not required.                //
// See common/ItemRegistry.js for a description of the action's format.                 //
//////////////////////////////////////////////////////////////////////////////////////////

var action = {
  name: _('Open File'),
  icon: 'text-x-generic',
  defaultData: '',
  // Translators: Please keep this short.
  subtitle: _('Opens a file with the default applications.'),
  description: _(
      'The <b>Open File</b> action will open the above specified file with your system\'s default application.'),
  itemClass: Enums.ItemClass.ACTION,
  dataType: Enums.ItemDataType.FILE,
  createItem: (data) => {
    return {
      activate: () => {
        try {
          Gio.AppInfo.launch_default_for_uri('file://' + data, null);
        } catch (error) {
          utils.debug('Failed to open file: ' + error);
        }
      }
    };
  }
};