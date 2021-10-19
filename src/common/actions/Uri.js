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
// The Uri action opens the defined URI with the system's default application.          //
// See common/ItemRegistry.js for a description of the action's format.                 //
//////////////////////////////////////////////////////////////////////////////////////////

var action = {

  // There are two fundamental item types in Fly-Pie: Actions and Menus. Actions have an
  // onSelect() method which is called when the user selects the item, Menus can have
  // child Actions or Menus.
  class: ItemRegistry.ItemClass.ACTION,

  // This will be shown in the add-new-item-popover of the settings dialog.
  name: _('Open URI'),

  // This is also used in the add-new-item-popover.
  icon: 'flypie-action-uri-symbolic-#449',

  // Translators: Please keep this short.
  // This is the (short) description shown in the add-new-item-popover.
  subtitle: _('Opens an URI with the default application.'),

  // This is the (long) description shown when an item of this type is selected.
  description: _(
      'When the <b>Open URI</b> action is activated, the above URI is opened with the default application. For http URLs, this will be your web browser. However, it is also possible to open other URIs such as "mailto:foo@bar.org".'),

  // Items of this type have an additional text configuration parameter which is the URI
  // which is to be opened.
  config: {
    // This is used as data for newly created items of this type.
    defaultData: {uri: ''},

    // This is called whenever an item of this type is selected in the menu editor. It
    // returns a Gtk.Widget which will be shown in the sidebar of the menu editor. The
    // currently configured data object will be passed as first parameter and *should* be
    // an object containing a single "uri" property. To stay backwards compatible with
    // Fly-Pie 4, we have to also handle the case where the URI is given as a simple
    // string value. The second parameter is a callback which is fired whenever the user
    // changes something in the widgets.
    getWidget(data, updateCallback) {
      let uri = '';
      if (typeof data === 'string') {
        uri = data;
      } else if (data.uri != undefined) {
        uri = data.uri;
      }

      return ConfigWidgetFactory.createTextWidget(
          _('URI'), _('It will be opened with the default app.'), null, uri, (uri) => {
            updateCallback({uri: uri});
          });
    }
  },

  // This will be called whenever a menu is opened containing an item of this kind.
  // The data parameter *should* be an object containing a single "uri" property. To
  // stay backwards compatible with Fly-Pie 4, we have to also handle the case where
  // the URI is given as a simple string value.
  createItem: (data) => {
    let uri = '';
    if (typeof data === 'string') {
      uri = data;
    } else if (data.uri != undefined) {
      uri = data.uri;
    }

    // The onSelect() function will be called when the user selects this action.
    return {
      onSelect: () => {
        try {
          Gio.AppInfo.launch_default_for_uri(uri, null);
        } catch (error) {
          utils.debug('Failed to open URL: ' + error);
        }
      }
    };
  }
};
