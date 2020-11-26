//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Me           = imports.misc.extensionUtils.getCurrentExtension();
const actions      = Me.imports.common.actions;
const submenus     = Me.imports.common.submenus;
const ItemDataType = Me.imports.common.ItemDataType.ItemDataType;

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
      // The top-level menu cannot be activated. It should always contain some
      // children.
      Menu: {
        name: _('Toplevel Menu'),
        icon: 'view-more-symbolic',
        defaultData: '',
        // Translators: Please keep this short.
        subtitle: _('Create as many as you want!'),
        description: _(
            'A <b>Toplevel Menu</b> can contain any number of menu items and submenus. However, for precise item selection, a maximum number of twelve items is recommended.\nThe menu can be opened using the shortcut defined above. It is also possible to open a menu with a terminal command. You can read more on <a href="https://github.com/Schneegans/Fly-Pie">Github</a>.'),
        settingsType: ItemDataType.MENU,
        settingsList: 'menu-types-list',
        createItem: (centered) => {
          return {centered: centered, children: []};
        }
      },

      // Submenus cannot be activated. They should always contain some children.
      Submenu: {
        name: _('Custom Submenu'),
        icon: 'view-more-horizontal-symbolic',
        defaultData: '',
        // Translators: Please keep this short.
        subtitle: _('Add structure to your menu!'),
        description: _(
            'The <b>Custom Submenu</b> can be used to group actions together. As deep hierarchies can be selected quite efficiently, feel free to create submenus in submenus!'),
        settingsType: ItemDataType.SUBMENU,
        settingsList: 'submenu-types-list',
        createItem: () => {
          return {children: []};
        }
      },



    };

    _itemTypes.Shortcut   = actions.Shortcut.action;
    _itemTypes.InsertText = actions.InsertText.action;
    _itemTypes.Command    = actions.Command.action;
    _itemTypes.Uri        = actions.Uri.action;
    _itemTypes.File       = actions.File.action;
    _itemTypes.DBusSignal = actions.DBusSignal.action;

    _itemTypes.Devices        = submenus.Devices.submenu;
    _itemTypes.Bookmarks      = submenus.Bookmarks.submenu;
    _itemTypes.System         = submenus.System.submenu;
    _itemTypes.Favorites      = submenus.Favorites.submenu;
    _itemTypes.FrequentlyUsed = submenus.FrequentlyUsed.submenu;
    _itemTypes.RecentFiles    = submenus.RecentFiles.submenu;
    _itemTypes.RunningApps    = submenus.RunningApps.submenu;

    // This is only possible if the GMenu typelib is installed on the system.
    if (GMenu) {
      _itemTypes.MainMenu = submenus.MainMenu.submenu;
    }
  }

  return _itemTypes;
};

// This uses the createItem() methods of the ItemRegistry to transform a menu
// configuration (as created by Fly-Pie's menu editor) to a menu structure (as
// required by the menu class). The main difference is that the menu structure may
// contain significantly more items - while the menu configuration only contains one
// item for "Bookmarks", the menu structure actually contains all of the bookmarks as
// individual items.
let _transformConfig =
    (config) => {
      let type = config.type;
      if (config.children != undefined) {
        type = 'Submenu';
      } else if (type == undefined) {
        type = 'DBusSignal';
      }

      const data = config.data;
      if (data == undefined) {
        data = getItemTypes()[type].defaultData;
      }

      const result = getItemTypes()[type].createItem(data);
      result.name  = config.name != undefined ? config.name : _('Unnamed Item');
      result.icon  = config.icon != undefined ? config.icon : 'image-missing';
      result.angle = config.angle != undefined ? config.angle : -1;

      // Load all children recursively.
      if (config.children) {
        for (let i = 0; i < config.children.length; i++) {
          result.children.push(_transformConfig(config.children[i]));
        }
      }

      return result;
    }

var transformConfig = (config) => {
  // Transform the configuration into a menu structure.
  const centered = config.centered != undefined ? config.centered : false;

  const structure = getItemTypes()['Menu'].createItem(centered);
  structure.name  = config.name != undefined ? config.name : _('Unnamed Menu');
  structure.icon  = config.icon != undefined ? config.icon : 'image-missing';

  for (let j = 0; j < config.children.length; j++) {
    structure.children.push(_transformConfig(config.children[j]));
  }

  return structure;
};
