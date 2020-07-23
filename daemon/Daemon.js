//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const {Gio, GLib} = imports.gi;

const Me            = imports.misc.extensionUtils.getCurrentExtension();
const Menu          = Me.imports.daemon.Menu.Menu;
const Shortcuts     = Me.imports.daemon.Shortcuts.Shortcuts;
const DBusInterface = Me.imports.common.DBusInterface.DBusInterface;
const utils         = Me.imports.common.utils;
const ItemRegistry  = Me.imports.common.ItemRegistry;
const DefaultMenu   = Me.imports.settings.DefaultMenu.DefaultMenu;

//////////////////////////////////////////////////////////////////////////////////////////
// The daemon listens on the D-Bus for show-menu requests and registers a global        //
// shortcut for each configured menu. For details on the D-Bus interface refer to       //
// common/DBusInterface.js. As soon as a valid request is received or a shortcut is     //
// pressed, an menu is shown accordingly.                                               //
//////////////////////////////////////////////////////////////////////////////////////////

var Daemon = class Daemon {

  // ------------------------------------------------------------ constructor / destructor

  constructor() {

    // Make the ShowMenu(), PreviewMenu(), ShowCustomMenu(), and the PreviewCustomMenu()
    // methods available on the D-Bus.
    this._dbus = Gio.DBusExportedObject.wrapJSObject(DBusInterface.description, this);
    this._dbus.export(Gio.DBus.session, '/org/gnome/shell/extensions/flypie');

    // Initialize the menu. The same menu is used again and again. It is just reconfigured
    // according to incoming requests.
    this._menu = new Menu(
        // Called when the user selects an item in the menu. This calls the OnSelect
        // signal of the DBusInterface.
        (menuID, path) => this._onSelect(menuID, path),

        // Called when the user does no select anything in the menu. This calls the
        // OnCancel signal of the DBusInterface.
        (menuID) => this._onCancel(menuID));

    // This is increased once for every menu request.
    this._currentID = 0;

    // This class manages the global shortcuts. Once one of the registered shortcuts is
    // pressed, the corresponding menu is shown via the ShowMenu() method. If an error
    // occurred, a notification is shown.
    this._shortcuts = new Shortcuts((shortcut) => {
      for (let i = 0; i < this._menuConfigs.length; i++) {
        if (shortcut == this._menuConfigs[i].shortcut) {
          const result = this.ShowMenu(this._menuConfigs[i].name);
          if (result < 0) {
            utils.notification(
                'Failed to open a Fly-Pie menu: ' +
                DBusInterface.getErrorDescription(result));
          }
        }
      }
    });

    // Create a settings object and listen for menu configuration changes. Once the
    // configuration changes, we bind all the configured shortcuts.
    this._settings = utils.createSettings();

    // Store the new menu configuration.
    let json                = this._settings.get_string('menu-configuration');
    let createDefaultConfig = false;

    try {
      const config = JSON.parse(json);
      if (!Array.isArray(config) || config.length == 0) {
        createDefaultConfig = true;
      }
    } catch {
      createDefaultConfig = true;
    }

    // Add default menu if non is configured.
    if (createDefaultConfig) {
      this._settings.set_string(
          'menu-configuration', JSON.stringify([DefaultMenu.get()]));
    }

    this._settingsConnection = this._settings.connect(
        'changed::menu-configuration', () => this._onMenuConfigsChanged());
    this._onMenuConfigsChanged();
  }

  // Cleans up stuff which is not cleaned up automatically.
  destroy() {
    this._menu.destroy();
    this._dbus.unexport();
    this._shortcuts.destroy();
    this._settings.disconnect(this._settingsConnection);
  }

  // -------------------------------------------------------------- public D-Bus-Interface

  // This opens a menu configured with Fly-Pie's menu editor and can be directly called
  // over the D-Bus. See common/DBusInterface.js for a description of Fly-Pie's
  // DBusInterface.
  ShowMenu(name) {
    return this._openMenu(name, false);
  }

  // This opens a menu configured with Fly-Pie's menu editor in preview mode and can be
  // directly called over the D-Bus. See common/DBusInterface.js for a description of
  // Fly-Pie's DBusInterface.
  PreviewMenu(name) {
    return this._openMenu(name, true);
  }

  // This opens a custom menu and can be directly called over the D-Bus.
  // See common/DBusInterface.js for a description of Fly-Pie's DBusInterface.
  ShowCustomMenu(json) {
    this._currentID = this._getNextID(this._currentID);
    return this._openCustomMenu(json, false, this._currentID);
  }

  // This opens a custom menu in preview mode and can be directly called over the D-Bus.
  // See common/DBusInterface.js for a description of Fly-Pie's DBusInterface.
  PreviewCustomMenu(json) {
    this._currentID = this._getNextID(this._currentID);
    return this._openCustomMenu(json, true, this._currentID);
  }

  // ----------------------------------------------------------------------- private stuff

  // Opens a menu configured with Fly-Pie's menu editor, optionally in preview mode. The
  // menu's name must be given as parameter. It will return a positive number on success
  // and a negative on failure. See common/DBusInterface.js for a list of error codes.
  _openMenu(name, previewMode) {

    // Search for the meu with the given name.
    for (let i = 0; i < this._menuConfigs.length; i++) {

      if (name == this._menuConfigs[i].name) {

        // Transform the configuration into a menu structure.
        const structure = ItemRegistry.ItemTypes['Menu'].createItem(
            this._menuConfigs[i].name, this._menuConfigs[i].icon);

        for (let j = 0; j < this._menuConfigs[i].children.length; j++) {
          structure.children.push(
              this._transformConfig(this._menuConfigs[i].children[j]));
        }

        // Once we transformed the menu configuration to a menu structure, we can open the
        // menu with the custom-menu method.
        const result =
            this._openCustomMenu(structure, previewMode, this._menuConfigs[i].id);

        // If that was successful, store the structure.
        if (result >= 0) {
          this._currentMenuStructure = structure;
        }

        // Return the menu's ID.
        return result;
      }
    }

    // There is no menu with such a name.
    return DBusInterface.errorCodes.eNoSuchMenu;
  }

  // Open the menu described by 'config', optionally in preview mode. 'config' can either
  // be a JSON string or an object containing the menu structure. This method will return
  // the menu's ID on success or an error code on failure. See common/DBusInterface.js for
  // a list of error codes.
  _openCustomMenu(config, previewMode, menuID) {

    let structure = config;

    // First try to parse the menu structure if it's given as a json string.
    if (typeof config === 'string') {
      try {
        structure = JSON.parse(config);
      } catch (error) {
        logError(error);
        return DBusInterface.errorCodes.eInvalidJSON;
      }
    }

    // Then try to open the menu. This will return the menu's ID on success or an error
    // code on failure.
    try {
      return this._menu.show(menuID, structure, previewMode);
    } catch (error) {
      logError(error);
    }

    // Something weird happened.
    return DBusInterface.errorCodes.eUnknownError;
  }

  // This gets called once the user made a selection in the menu.
  _onSelect(menuID, path) {

    // This is set if we opened one of the menus configured with Fly-Pie's menu editor.
    // Else it was a custom menu opened via the D-Bus.
    if (this._currentMenuStructure != null) {

      // The path is a string like /2/2/4 indicating that the fourth entry in the second
      // entry of the second entry was clicked on.
      const pathElements = path.split('/');

      // Now follow the path in our menu structure.
      let item = this._currentMenuStructure;
      for (let i = 1; i < pathElements.length; ++i) {
        item = item.children[pathElements[i]];
      }

      // And finally activate the item!
      item.activate();

      // The menu is now hidden.
      this._currentMenuStructure = null;
    }

    // Emit the OnSelect signal of our D-Bus interface.
    this._dbus.emit_signal('OnSelect', GLib.Variant.new('(is)', [menuID, path]));
  }

  // This gets called when the user did not select anything in the menu.
  _onCancel(menuID) {

    // This is set if we opened one of the menus configured with Fly-Pie's menu editor.
    // Else it was a custom menu opened via the D-Bus.
    if (this._currentMenuStructure != null) {

      // The menu is now hidden.
      this._currentMenuStructure = null;
    }

    // mit the OnCancel signal of our D-Bus interface.
    this._dbus.emit_signal('OnCancel', GLib.Variant.new('(i)', [menuID]));
  }

  // This uses the createItem() methods of the ItemRegistry to transform a menu
  // configuration (as created by Fly-Pie's menu editor) to a menu structure (as
  // required by the menu class). The main difference is that the menu structure may
  // contain significantly more items - while the menu configuration only contains one
  // item for "Bookmarks", the menu structure actually contains all of the bookmarks as
  // individual items.
  _transformConfig(config) {
    const icon  = config.icon != undefined ? config.icon : '';
    const name  = config.name != undefined ? config.name : '';
    const type  = config.type != undefined ? config.type : '';
    const data  = config.data != undefined ? config.data : '';
    const angle = config.angle != undefined ? config.angle : -1;

    const result = ItemRegistry.ItemTypes[type].createItem(name, icon, angle, data);

    // Load all children recursively.
    if (config.children) {
      for (let i = 0; i < config.children.length; i++) {
        result.children.push(this._transformConfig(config.children[i]));
      }
    }

    return result;
  }

  // Whenever the menu configuration changes, we check for any new shortcuts which need to
  // be bound.
  _onMenuConfigsChanged() {

    // Store the new menu configuration.
    this._menuConfigs = JSON.parse(this._settings.get_string('menu-configuration'));

    // First we create a set of all required shortcuts.
    const newShortcuts = new Set();
    for (let i = 0; i < this._menuConfigs.length; i++) {
      if (this._menuConfigs[i].shortcut) {
        newShortcuts.add(this._menuConfigs[i].shortcut);
      }
    }

    // Then we iterate over all currently bound shortcuts and unbind the ones which are
    // not required anymore and remove the one which are already bound from the set of
    // required shortcuts.
    for (let existingShortcut of this._shortcuts.getBound()) {
      if (newShortcuts.has(existingShortcut)) {
        newShortcuts.delete(existingShortcut);
      } else {
        this._shortcuts.unbind(existingShortcut);
      }
    }

    // Finally, we bind any remaining shortcuts from our set.
    for (let requiredShortcut of newShortcuts) {
      this._shortcuts.bind(requiredShortcut);
    }

    // There is currently a menu created with Fly-Pie's menu editor open, so we
    // potentially have to update the displayed menu (we might be in preview mode).
    if (this._currentMenuStructure != null) {
      for (let i = 0; i < this._menuConfigs.length; i++) {
        if (this._menuConfigs[i].id == this._menu.getID()) {
          // Transform the configuration into a menu structure.
          const structure = ItemRegistry.ItemTypes['Menu'].createItem(
              this._menuConfigs[i].name, this._menuConfigs[i].icon);

          for (let j = 0; j < this._menuConfigs[i].children.length; j++) {
            structure.children.push(
                this._transformConfig(this._menuConfigs[i].children[j]));
          }

          // Once we transformed the menu configuration to a menu structure, we can update
          // the menu with the new structure.
          const result = this._menu.update(structure);

          // If that was successful, store the structure.
          if (result >= 0) {
            this._currentMenuStructure = structure;
            return;
          }

          break;
        }
      }

      // Something went wrong in updating the preview. Let's hide it.
      this._onCancel(this._menu.getID());
      this._menu.hide();
    }
  }

  // This returns a new ID for a custom show-menu request. The last ID is increased by, if
  // the result collides with an ID of a menu configured with Fly-Pie's menu editor, it
  // is increased once more.
  _getNextID(lastID) {
    let nextID  = lastID;
    let isInUse = false;

    do {
      ++nextID;
      isInUse = false;

      // Check whether this ID is in use.
      for (let i = 0; i < this._menuConfigs.length; i++) {
        if (this._menuConfigs[i].id == nextID) {
          isInUse = true;
        }
      }

    } while (isInUse);

    return nextID;
  }
};