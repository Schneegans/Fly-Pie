//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const GMenu = imports.gi.GMenu;

const _ = imports.gettext.domain('flypie').gettext;

const Me    = imports.misc.extensionUtils.getCurrentExtension();
const utils = Me.imports.common.utils;
const Enums = Me.imports.common.Enums;


//////////////////////////////////////////////////////////////////////////////////////////
// Returns an item containing the menu tree of all installed applications.              //
// See common/ItemRegistry.js for a description of the action's format.                 //
//////////////////////////////////////////////////////////////////////////////////////////

var menu = {
  name: _('Main Menu'),
  icon: 'applications-system',
  // Translators: Please keep this short.
  subtitle: _('Shows all installed applications.'),
  description: _(
      'The <b>Main Menu</b> shows all installed applications. Usually, this is very cluttered as many sections contain too many items to be used efficiently. You should rather setup your own menus!'),
  itemClass: Enums.ItemClass.MENU,
  dataType: Enums.ItemDataType.NONE,
  defaultData: '',
  createItem: () => {
    const pushMenuItems = (menu, dir) => {
      let iter = dir.iter(), nodeType, item;

      while ((nodeType = iter.next()) !== GMenu.TreeItemType.INVALID) {
        switch (nodeType) {

          // Add an item for each application.
          case GMenu.TreeItemType.ENTRY:
            const app = iter.get_entry().get_app_info();
            let icon  = 'image-missing';
            if (app.get_icon()) {
              icon = app.get_icon().to_string();
            }
            item = {
              name: app.get_name(),
              icon: icon,
              activate: () => {
                const ctx = global.create_app_launch_context(0, -1);

                try {
                  app.launch([], ctx);
                } catch (error) {
                  utils.debug('Failed to launch app: ' + error);
                }
              }
            };
            menu.children.push(item);
            break;

          // Recursively add child items to directories.
          case GMenu.TreeItemType.DIRECTORY:
            const directory = iter.get_directory();
            item            = {
              name: directory.get_name(),
              icon: directory.get_icon().to_string(),
              children: []
            };

            pushMenuItems(item, directory);
            menu.children.push(item);
            break;

          // SEPARATOR, HEADER, ALIAS. skip for now.
          default:
            break;
        }
      }
    };


    const menu =
        new GMenu.Tree({menu_basename: 'applications.menu', flags: GMenu.TreeFlags.NONE});

    menu.load_sync();

    const result = {children: []};

    pushMenuItems(result, menu.get_root_directory());

    return result;
  }
};