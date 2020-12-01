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
const Enums = Me.imports.common.Enums;

//////////////////////////////////////////////////////////////////////////////////////////
// A menu cannot be activated. It should always contain some children.                  //
// See common/ItemRegistry.js for a description of the action's format.                 //
//////////////////////////////////////////////////////////////////////////////////////////

var menu = {
  name: _('Custom Menu'),
  icon: 'view-more-symbolic',
  // Translators: Please keep this short.
  subtitle: _('This can contain actions and other menus.'),
  description: _(
      'A <b>Custom Menu</b> can contain any number of actions and submenus. However, for precise item selection, a maximum number of twelve items is recommended.\nWhen used as top-level menu, it can be opened with a key combination. It is also possible to open a menu with a terminal command. You can read more on <a href="https://github.com/Schneegans/Fly-Pie">Github</a>.'),
  itemClass: Enums.ItemClass.MENU,
  dataType: Enums.ItemDataType.NONE,
  defaultData: '',
  createItem: (centered) => {
    return {centered: centered, children: []};
  }
};