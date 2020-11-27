//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Me      = imports.misc.extensionUtils.getCurrentExtension();
const actions = Me.imports.common.actions;
const menus   = Me.imports.common.menus;
const Enums   = Me.imports.common.Enums;

const _ = imports.gettext.domain('flypie').gettext;

// GMenu is not necessarily installed on all systems. So we include it optionally here. If
// it is not found, the Main Menu Submenu will not be available.
let GMenu = undefined;

try {
  GMenu = imports.gi.GMenu;
} catch (error) {
  // Nothing to be done, we're in settings-mode.
}

//////////////////////////////////////////////////////////////////////////////////////////
// This huge object contains one key for each registered item type. Each item type      //
// should have six properties:                                                          //
//   name:         This will be shown in the add-new-item popover. It is also the       //
//                 default name of newly created items of this type.                    //
//   icon:         The icon name used in the add-new-item popover. It is also the       //
//                 default icon of newly created items of this type.                    //
//   subtitle:     This will be shown as small text in the add-new-item popover.        //
//                 Keep it short or use line breaks, else the popover will get wide.    //
//   description:  This will be shown in the right hand side settings when an item of   //
//                 this type is selected.                                               //
//   settingsType: This determines which widgets are visible when an item of this type  //
//                 is selected in the settings dialog. See documentation above.         //
//   settingsList: The Glade name of the list in the add-new-item popover where this    //
//                 item should be listed.                                               //
//   createItem:   A function which will be called on the client side to instantiate a  //
//                 menu item of this type.                                              //
//////////////////////////////////////////////////////////////////////////////////////////

let _itemTypes = null;

var getItemTypes = () => {
  if (_itemTypes == null) {
    _itemTypes = {
      // A menu cannot be activated. It should always contain some children.
      Menu: {
        name: _('Custom Menu'),
        icon: 'view-more-symbolic',
        defaultData: '',
        // Translators: Please keep this short.
        subtitle: _('Create menus in menus in menus!'),
        description: _(
            'A <b>Custom Menu</b> can contain any number of actions and submenus. However, for precise item selection, a maximum number of twelve items is recommended.\nTop-level menus can be opened using a shortcut. It is also possible to open a menu with a terminal command. You can read more on <a href="https://github.com/Schneegans/Fly-Pie">Github</a>.'),
        itemClass: Enums.ItemClass.MENU,
        dataType: Enums.ItemDataType.NONE,
        createItem: (centered) => {
          return {centered: centered, children: []};
        }
      },

    };

    _itemTypes.Shortcut   = actions.Shortcut.action;
    _itemTypes.InsertText = actions.InsertText.action;
    _itemTypes.Command    = actions.Command.action;
    _itemTypes.Uri        = actions.Uri.action;
    _itemTypes.File       = actions.File.action;
    _itemTypes.DBusSignal = actions.DBusSignal.action;

    _itemTypes.Devices        = menus.Devices.menu;
    _itemTypes.Bookmarks      = menus.Bookmarks.menu;
    _itemTypes.System         = menus.System.menu;
    _itemTypes.Favorites      = menus.Favorites.menu;
    _itemTypes.FrequentlyUsed = menus.FrequentlyUsed.menu;
    _itemTypes.RecentFiles    = menus.RecentFiles.menu;
    _itemTypes.RunningApps    = menus.RunningApps.menu;

    // This is only possible if the GMenu typelib is installed on the system.
    if (GMenu) {
      _itemTypes.MainMenu = menus.MainMenu.menu;
    }
  }

  return _itemTypes;
};

let _transformConfig = (config, isToplevel) => {
  // First we try to get the item type.
  let type = config.type;

  // For backwards compatibility with Fly-Pie 3 and earlier.
  if (type == 'Submenu') {
    type = 'Menu';
  }

  // If no type is given but there are children, we assume a Menu.
  if (type == undefined && config.children != undefined) {
    type = 'Menu';
  }

  // If no type is given and no children, we assume a DBusSignal.
  if (type == undefined && config.children == undefined) {
    type = 'DBusSignal';
  }

  // It's an error if the type is not Menu but there are children.
  if (type != 'Menu' && config.children != undefined) {
    throw 'Only items of type \'Menu\' may contain child items!';
  }

  // It's an error if a top-level element is not of the menu class.
  if (isToplevel && getItemTypes()[type].itemClass != Enums.ItemClass.MENU) {
    throw 'Top-level items must be menu types!';
  }

  // Now we get the data field.
  let data = config.data;
  if (data == undefined) {
    data = getItemTypes()[type].defaultData;
  }

  const result = getItemTypes()[type].createItem(data);
  result.name  = config.name != undefined ? config.name : _('Unnamed Item');
  result.icon  = config.icon != undefined ? config.icon : 'image-missing';

  // The 'centered' property is only available on top-level items, the 'angle' property on
  // all other items.
  if (isToplevel) {
    result.centered = config.centered != undefined ? config.centered : false;
  } else {
    result.angle = config.angle != undefined ? config.angle : -1;
  }

  // Load all children recursively.
  if (config.children) {
    for (let i = 0; i < config.children.length; i++) {
      result.children.push(_transformConfig(config.children[i], false));
    }
  }

  return result;
};

// This uses the createItem() methods of the ItemRegistry to transform a menu
// configuration (as created by Fly-Pie's menu editor) to a menu structure (as
// required by the menu class). The main difference is that the menu structure may
// contain significantly more items - while the menu configuration only contains one
// item for "Bookmarks", the menu structure actually contains all of the bookmarks as
// individual items.
var transformConfig = (config) => {
  return _transformConfig(config, true);
};
