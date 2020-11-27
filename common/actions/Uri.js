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
// The Uri action opens the defined URI with the system's default application.          //
// See common/ItemRegistry.js for a description of the action's format.                 //
//////////////////////////////////////////////////////////////////////////////////////////

var action = {
  name: _('Open URI'),
  icon: 'applications-internet',
  defaultData: '',
  // Translators: Please keep this short.
  subtitle: _('Opens an URI with the default applications.'),
  description: _(
      'When the <b>Open URI</b> action is activated, the above URI is opened with the default application. For http URLs, this will be your web browser. However, it is also possible to open other URIs such as "mailto:foo@bar.org".'),
  itemClass: Enums.ItemClass.ACTION,
  dataType: Enums.ItemDataType.URL,
  createItem: (data) => {
    return {
      activate: () => {
        try {
          Gio.AppInfo.launch_default_for_uri(data, null);
        } catch (error) {
          utils.debug('Failed to open URL: ' + error);
        }
      }
    };
  }
};