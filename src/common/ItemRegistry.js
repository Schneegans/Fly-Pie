//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const _ = imports.gettext.domain('flypie').gettext;

// GMenu is not necessarily installed on all systems. So we include it optionally here. If
// it is not found, the Main Menu Submenu will not be available.
let GMenu = undefined;

try {
  GMenu = imports.gi.GMenu;
} catch (error) {
  // Nothing to be done, we're in settings-mode.
}

const Me      = imports.misc.extensionUtils.getCurrentExtension();
const actions = Me.imports.src.common.actions;
const menus   = Me.imports.src.common.menus;
const utils   = Me.imports.src.common.utils;

//////////////////////////////////////////////////////////////////////////////////////////
// Menus of Fly-Pie are composed of individual menu items. A menu item can either be an //
// Action - such an item performs something once activated - or a Menu. Menus do not    //
// perform anything but may contain a list of child items.                              //
//////////////////////////////////////////////////////////////////////////////////////////

var ItemClass = {MENU: 0, ACTION: 1};

//////////////////////////////////////////////////////////////////////////////////////////
// Each menu item type has a data type - this determines which widgets are visible      //
// when an item of this type is selected in the settings dialog. If you create a new    //
// item type, this list may have to be extended. This will also require some changes to //
// the MenuEditor.js as this is responsible for showing and hiding the widgets          //
// accordingly.                                                                         //
//////////////////////////////////////////////////////////////////////////////////////////

var ItemDataType = {
  TEXT: 0,      // A Gtk.Entry for arbitrary text.
  SHORTCUT: 1,  // A shortcut-selector is shown.
  COMMAND: 2,   // A Gtk.Entry with an additional button for searching installed apps.
  FILE: 3,      // A Gtk.Entry with an additional file chooser button.
  COUNT: 4      // A Gtk.SpinButton for selecting numbers.
};

//////////////////////////////////////////////////////////////////////////////////////////
// The getItemTypes() of the ItemRegistry can be used to access all available action    //
// and menu types. Each item type should have eight properties:                         //
//   class:        This should be either ItemClass.ACTION or ItemClass.MENU.            //
//                 The former is used for single items with an activate() method, the   //
//                 latter for menus which are composed of multiple actions or menus.    //
//   name:         This will be shown in the add-new-item popover. It is also the       //
//                 default name of newly created items of this type. This should be     //
//                 translatable.                                                        //
//   icon:         The icon name used in the add-new-item popover. It is also the       //
//                 default icon of newly created items of this type.                    //
//   subtitle:     This will be shown as small text in the add-new-item popover.        //
//                 Keep it short or use line breaks, else the popover will get wide.    //
//                 This should be translatable.                                         //
//   description:  This will be shown in the right hand side settings when an item of   //
//                 this type is selected. This should be translatable.                  //
//   data:         An optional object which defines some additional data which can be   //
//                 chosen by the user. The additional data is always stored as a        //
//                 string. If you actually need to store a number (e.g. for             //
//                 ItemDataType.COUNT, you will have to use parseInt(data) in the       //
//                 createItem() method.                                                 //
//                   type:        This determines which widget is shown to select the   //
//                                data in the settings dialog. Possible values are      //
//                                listed in ItemDataType above.                         //
//                   name:        This will be shown on the left above the data widget  //
//                                in the settings dialog.                               //
//                   description: This will be shown on the right above the data widget //
//                                in the settings dialog.                               //
//                   default:     This string value will be used as data for newly      //
//                                created items.                                        //
//   createItem:   A function which will be called whenever a menu is opened containing //
//                 an item of this kind. The data value chosen by the user will be      //
//                 passed to this function.                                             //
//////////////////////////////////////////////////////////////////////////////////////////

let _itemTypes = null;

var ItemRegistry = class ItemRegistry {

  // ---------------------------------------------------------------------- static methods

  // This takes a menu configuration (as created by Fly-Pie's menu editor) and checks that
  // most constraints are fulfilled (e.g. required data fields are set, no top-level
  // actions, etc.) and fills the objects with default data if no data is given.
  static normalizeConfig(config) {
    this._normalizeConfig(config, true);
  }

  // This uses the createItem() methods of the registered actions and menus to transform a
  // menu configuration (as created by Fly-Pie's menu editor) to a menu structure (as
  // required by the menu class). The main difference is that the menu structure may
  // contain significantly more items - while the menu configuration only contains one
  // item for "Bookmarks", the menu structure actually contains all of the bookmarks as
  // individual items.
  // This method assumes a "normalized" config, so you should call the normalizeConfig()
  // above before this one.
  static transformConfig(config) {
    return this._transformConfig(config, true);
  }

  // Returns an object with all available item types (actions and menus).
  static getItemTypes() {

    if (_itemTypes == null) {
      _itemTypes = {

        // Action types.
        Shortcut: actions.Shortcut.action,
        InsertText: actions.InsertText.action,
        Command: actions.Command.action,
        Uri: actions.Uri.action,
        File: actions.File.action,
        DBusSignal: actions.DBusSignal.action,

        // Menu types.
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

  // See documentation of normalizeConfig() above.
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

    // If we have an unknown item type, we assume 'CustomMenu' if we have children and
    // 'DBusSignal' otherwise.
    if (this.getItemTypes()[config.type] == undefined) {
      if (config.children == undefined) {
        utils.debug(
            'Warning: Unknown item type \'' + config.type +
            '\'! Using \'DBusSignal\' instead.');
        config.type = 'DBusSignal';
      } else {
        utils.debug(
            'Warning: Unknown item type \'' + config.type +
            '\'! Using \'CustomMenu\' instead as this item has children.');
        config.type = 'CustomMenu';
      }
    }

    // It's an error if the type is not Menu but there are children.
    if (config.type != 'CustomMenu' && config.children != undefined) {
      throw 'Only items of type \'CustomMenu\' may contain child items!';
    }

    // It's an error if a top-level element is not of the menu class.
    if (isToplevel && this.getItemTypes()[config.type].class != ItemClass.MENU) {
      throw 'Top-level items must be menu types!';
    }

    // Assign default data.
    if (config.data == undefined) {
      if (this.getItemTypes()[config.type].data != undefined) {
        config.data = this.getItemTypes()[config.type].data.default;
      } else {
        config.data = '';
      }
    }

    // Assign default name.
    if (config.name == undefined) {
      config.name = this.getItemTypes()[config.type].name;
    }

    // Assign default icon.
    if (config.icon == undefined) {
      config.icon = this.getItemTypes()[config.type].icon;
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

  // See documentation of transformConfig() above.
  static _transformConfig(config, isToplevel) {

    // Create the item and then set all the standard-properties later.
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