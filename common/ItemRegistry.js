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

var ItemRegistry = class ItemRegistry {

  // ---------------------------------------------------------------------- static methods

  static normalizeConfig(config) {
    return this._normalizeConfig(config, true);
  }

  // This uses the createItem() methods of the ItemRegistry to transform a menu
  // configuration (as created by Fly-Pie's menu editor) to a menu structure (as
  // required by the menu class). The main difference is that the menu structure may
  // contain significantly more items - while the menu configuration only contains one
  // item for "Bookmarks", the menu structure actually contains all of the bookmarks as
  // individual items.
  static transformConfig(config) {
    return this._transformConfig(config, true);
  }

  static getItemTypes() {

    if (_itemTypes == null) {
      _itemTypes = {
        Shortcut: actions.Shortcut.action,
        InsertText: actions.InsertText.action,
        Command: actions.Command.action,
        Uri: actions.Uri.action,
        File: actions.File.action,
        DBusSignal: actions.DBusSignal.action,

        CustomMenu: menus.CustomMenu.menu,
        Devices: menus.Devices.menu,
        Bookmarks: menus.Bookmarks.menu,
        System: menus.System.menu,
        Favorites: menus.Favorites.menu,
        FrequentlyUsed: menus.FrequentlyUsed.menu,
        RecentFiles: menus.RecentFiles.menu,
        RunningApps: menus.RunningApps.menu,
      };

      // This is only possible if the GMenu typelib is installed on the system.
      if (GMenu) {
        _itemTypes.MainMenu = menus.MainMenu.menu;
      }
    }

    return _itemTypes;
  }

  // ----------------------------------------------------------------------- private stuff
  static _normalizeConfig(config, isToplevel) {

    // If no type is given and no children, we assume a DBusSignal.
    if (config.type == undefined && config.children == undefined) {
      config.type = 'DBusSignal';
    }

    // If no type is given but there are children, we assume a Custom Menu.
    if (config.type == undefined && config.children != undefined) {
      config.type = 'CustomMenu';
    }

    // For backwards compatibility with Fly-Pie 3 and earlier.
    if (config.type == 'Submenu' || config.type == 'Menu') {
      config.type = 'CustomMenu';
    }

    // It's an error if the type is not Menu but there are children.
    if (config.type != 'CustomMenu' && config.children != undefined) {
      throw 'Only items of type \'CustomMenu\' may contain child items!';
    }

    // It's an error if a top-level element is not of the menu class.
    if (isToplevel &&
        this.getItemTypes()[config.type].itemClass != Enums.ItemClass.MENU) {
      throw 'Top-level items must be menu types!';
    }

    // Assign default data if required.
    if (config.data == undefined) {
      config.data = this.getItemTypes()[config.type].defaultData;
    }

    // Assign default values.
    if (config.name == undefined) {
      if (isToplevel) {
        config.name = _('Unnamed Menu');
      } else {
        config.name = _('Unnamed Item');
      }
    }

    if (config.icon == undefined) {
      config.icon = 'image-missing';
    }

    // The 'shortcut' and the 'centered' property is only available on top-level items,
    // the 'angle' property on all other items.
    if (isToplevel) {
      config.centered = config.centered != undefined ? config.centered : false;
      config.shortcut = config.shortcut != undefined ? config.shortcut : '';
    } else {
      config.angle = config.angle != undefined ? config.angle : -1;
    }

    // Check all children recursively.
    if (config.children) {
      for (let i = 0; i < config.children.length; i++) {
        this._normalizeConfig(config.children[i], false);
      }
    }
  }

  static _transformConfig(config, isToplevel) {

    const result = this.getItemTypes()[config.type].createItem(config.data);
    result.name  = config.name;
    result.icon  = config.icon;

    // The 'centered' property is only available on top-level items, the 'angle' property
    // on all other items.
    if (isToplevel) {
      result.centered = config.centered;
    } else {
      result.angle = config.angle;
    }

    // Load all children recursively.
    if (config.children) {
      for (let i = 0; i < config.children.length; i++) {
        result.children.push(this._transformConfig(config.children[i], false));
      }
    }

    return result;
  }
}