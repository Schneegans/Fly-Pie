//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const {GLib, Gio} = imports.gi;

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
// The getItemTypes() of the ItemRegistry can be used to access all available action    //
// and menu types. Each item type should have eight properties:                         //
//   class:        This should be either ItemClass.ACTION or ItemClass.MENU.            //
//                 The former is used for single items with an onSelect() method, the   //
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
//   config:       An optional object which defines additional data which can be        //
//                 configured by the user. The object must have to properties:          //
//                    defaultData: A object defining the default data which will be     //
//                                 stored for newly created items of this type. When a  //
//                                 new item is selected, the getWidget() method below   //
//                                 will be executed and the defaultData object will be  //
//                                 passed as first parameter.                           //
//                    getWidget:   A function which returns a Gtk.Widget which will be  //
//                                 shown in the menu editor when an item of this type   //
//                                 is selected. The function receives two arguments:    //
//                                 First an object containing the currently configured  //
//                                 item data, second a callback which should be fired   //
//                                 whenever the user changes the state of the widget.   //
//                                 The new data should be passed as object to the       //
//                                 callback.                                            //
//   createItem:   A function which will be called whenever a menu is opened containing //
//                 an item of this kind. The data value chosen by the user will be      //
//                 passed to this function as object.                                   //
//////////////////////////////////////////////////////////////////////////////////////////

let _itemTypes = null;

var ItemRegistry = class ItemRegistry {

  // ---------------------------------------------------------------------- static methods

  // This takes a menu configuration (as created by Fly-Pie's menu editor) and checks that
  // most constraints are fulfilled (e.g. required data fields are set, no top-level
  // actions, etc.) and fills the objects with default data if no data is given.
  // This may throw an exception if a constraint is violated.
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
        Clipboard: menus.Clipboard.menu,
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

  // Given an item type (like "CustomMenu"), this will create a default configuration
  // object. It will have a "name", "type", and "icon" property. If a "CustomMenu" is
  // requested, it will also contain an empty "children" list. If the type provides an
  // additional data field, this will be set as well and initialized to the default data.
  // Note that this does not set the properties required for toplevel menus (e.g. the "id"
  // and shortcut "properties").
  static createDefaultConfig(type) {

    const newItem = {
      name: this.getItemTypes()[type].name,
      icon: this.getItemTypes()[type].icon,
      type: type,
    };

    // Assign default children.
    if (type == 'CustomMenu') {
      newItem.children = [];
    }

    // Assign default custom data.
    if (this.getItemTypes()[type].config != undefined) {
      newItem.data = this.getItemTypes()[type].config.defaultData;
    }

    return newItem;
  }

  // This function creates a new action configuration object for a given text. If the text
  // is an URI to a file, a file action is created. If it's a *.desktop file, a "Launch
  // Application" action is created, an URI action is created for all other URIs.
  // If text is not an URI, an "Insert Text" action is created.
  static createActionConfig(text) {
    const item = {angle: -1};

    const uriScheme = GLib.uri_parse_scheme(text);
    let success     = false;

    if (uriScheme != null) {
      // First we check whether the dragged data contains an URI. If it points to
      // a *.desktop file, we create a "Launch Application" item for the
      // corresponding application.
      if (uriScheme == 'file') {
        const file = Gio.File.new_for_uri(text);

        if (file.query_exists(null)) {

          if (text.endsWith('.desktop')) {

            const info = Gio.DesktopAppInfo.new_from_filename(file.get_path());
            const type = 'Command';

            let icon = ItemRegistry.getItemTypes()[type].icon;
            if (info.get_icon()) {
              icon = info.get_icon().to_string();
            }

            if (info != null) {
              item.data = {command: info.get_commandline()};
              item.icon = icon;
              item.name = info.get_display_name();
              item.type = type;

              success = true;
            }
          }

          // If it's an URI to any other local file, we create an "Open File"
          // item.
          if (!success) {
            const type = 'File';
            const info = file.query_info('standard::icon', 0, null);

            if (info != null) {
              // Skip the file://
              item.data = {file: text.substring(7)};
              item.icon = info.get_icon().to_string();
              item.name = file.get_basename();
              item.type = type;

              success = true;
            }
          }
        }
      }

      if (!success) {

        // For any other URI we create an "Open URI" item.
        const type = 'Uri';
        const name = text.length < 20 ? text : text.substring(0, 20) + '...';

        item.data = {uri: text};
        item.icon = ItemRegistry.getItemTypes()[type].icon;
        item.name = name;
        item.type = type;
        success   = true;
      }
    }

    // If it's not an URI, we create an "Insert Text" action.
    else {
      const type = 'InsertText';
      const name = text.length < 20 ? text : text.substring(0, 20) + '...';

      item.data = {text: text};
      item.icon = ItemRegistry.getItemTypes()[type].icon;
      // Translators: If some text is dragged to the menu editor, an insert-text action is
      // created. This is the name of the newly created action, %s will be replaced by the
      // text to insert.
      item.name = _('Insert: %s').format(name);
      item.type = type;
    }

    return item;
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
      if (this.getItemTypes()[config.type].config != undefined) {
        config.data = this.getItemTypes()[config.type].config.defaultData;
      } else {
        config.data = {};
      }
    }

    // Assign default children list.
    if (config.type == 'CustomMenu' && config.children == undefined) {
      config.children = [];
    }

    // Assign default name.
    if (config.name == undefined) {
      config.name = this.getItemTypes()[config.type].name;
    }

    // Assign default icon.
    if (config.icon == undefined) {
      config.icon = this.getItemTypes()[config.type].icon;
    }

    // The 'shortcut', 'touchButton', 'superRMB', and 'centered' property is only
    // available on top-level items, the 'angle' property on all other items.
    if (isToplevel) {
      config.centered    = config.centered != undefined ? config.centered : false;
      config.shortcut    = config.shortcut != undefined ? config.shortcut : '';
      config.touchButton = config.touchButton != undefined ? config.touchButton : false;
      config.superRMB    = config.superRMB != undefined ? config.superRMB : false;
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