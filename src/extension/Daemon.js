//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Cairo                           = imports.cairo;
const {Gio, GLib, Gdk, GdkPixbuf, St} = imports.gi;

const Main = imports.ui.main;

const Me               = imports.misc.extensionUtils.getCurrentExtension();
const utils            = Me.imports.src.common.utils;
const Statistics       = Me.imports.src.common.Statistics.Statistics;
const Achievements     = Me.imports.src.common.Achievements.Achievements;
const ItemRegistry     = Me.imports.src.common.ItemRegistry.ItemRegistry;
const DBusInterface    = Me.imports.src.common.DBusInterface.DBusInterface;
const Shortcuts        = Me.imports.src.extension.Shortcuts.Shortcuts;
const TouchButtons     = Me.imports.src.extension.TouchButtons.TouchButtons;
const MouseHighlight   = Me.imports.src.extension.MouseHighlight.MouseHighlight;
const Menu             = Me.imports.src.extension.Menu.Menu;
const DefaultMenu      = Me.imports.src.extension.DefaultMenu.DefaultMenu;
const ClipboardManager = Me.imports.src.extension.ClipboardManager.ClipboardManager;

//////////////////////////////////////////////////////////////////////////////////////////
// The daemon listens on the D-Bus for show-menu requests and registers a global        //
// shortcut for each configured menu. For details on the D-Bus interface refer to       //
// the README.md. As soon as a valid request is received or a shortcut is pressed, an   //
// menu is shown or updated accordingly.                                                //
//////////////////////////////////////////////////////////////////////////////////////////

var Daemon = class Daemon {

  // ------------------------------------------------------------ constructor / destructor

  constructor() {

    // Load all of Fly-Pie's resources.
    this._resources = Gio.Resource.load(Me.path + '/resources/flypie.gresource');
    Gio.resources_register(this._resources);

    // Make the ShowMenu(), PreviewMenu(), ShowCustomMenu(), and the PreviewCustomMenu()
    // methods available on the D-Bus.
    this._dbus = Gio.DBusExportedObject.wrapJSObject(DBusInterface.description, this);
    this._dbus.export(Gio.DBus.session, '/org/gnome/shell/extensions/flypie');

    // Enable animations even if no hardware acceleration is available.
    if (global.backend && !global.backend.is_rendering_hardware_accelerated()) {
      St.Settings.get().uninhibit_animations();
    }

    // Create the clipboard manager singleton. This is used by the clipboard menu.
    ClipboardManager.getInstance();

    // Create a settings object and listen for menu configuration changes. Once the
    // configuration changes, we bind all the configured shortcuts.
    this._settings = utils.createSettings();

    // We keep several connections to the Gio.Settings object. Once the extension is
    // unloaded, we use this array to disconnect all of them.
    this._settingsConnections = [];

    // Initialize the menu. For performance reasons the same menu is used again and again.
    // It is just reconfigured according to incoming requests.
    this._menu = new Menu(
        this._settings,
        // This gets called whenever the user starts hovering an action in point-and-click
        // mode or starts dragging an action in marking mode. It emits the OnHover signal
        // of our D-Bus interface.
        (menuID, itemID) => this._onHover(menuID, itemID),

        // This gets called whenever the user stops hovering an action in point-and-click
        // mode or stops dragging an action in marking mode. It emits the OnUnhover signal
        // of our D-Bus interface.
        (menuID, itemID) => this._onUnhover(menuID, itemID),

        // Called when the user selects an item in the menu. This calls the OnSelect
        // signal of the DBusInterface.
        (menuID, itemID) => this._onSelect(menuID, itemID),

        // Called when the user does no select anything in the menu. This calls the
        // OnCancel signal of the DBusInterface.
        (menuID) => this._onCancel(menuID));

    // This is increased once for every menu request.
    this._lastMenuID = 0;

    // This class manages the global shortcuts. Once one of the registered shortcuts is
    // pressed, the corresponding menu is shown via the ShowMenu() method. If an error
    // occurred, a notification is shown.
    this._shortcuts = new Shortcuts();

    // This is called further below. It opens the preconfigured menu with the given name.
    const showMenu = (name) => {
      const result = this.ShowMenu(name);
      if (result < 0) {
        utils.debug(
            'Failed to open a Fly-Pie menu: ' +
            DBusInterface.getErrorDescription(result));
      }
    };

    // Open a menu when the corresponding shortcut is pressed.
    this._shortcuts.connect('activated', (s, shortcut) => {
      for (let i = 0; i < this._menuConfigs.length; i++) {
        if (shortcut == this._menuConfigs[i].shortcut) {
          showMenu(this._menuConfigs[i].name);
          break;
        }
      }
    });

    // Open a menu when the Super+RMB combination is pressed and a menu is configured to
    // listen to it.
    this._shortcuts.connect('super-rmb', () => {
      // Do not attempt to open a new menu if one is already opened.
      if (this._menu.getID() == null) {
        for (let i = 0; i < this._menuConfigs.length; i++) {
          if (this._menuConfigs[i].superRMB) {
            showMenu(this._menuConfigs[i].name);

            // We have a menu bound to Super+RMB, so we have to prevent the normal
            // behavior.
            return true;
          }
        }
      }

      // No menu is bound to Super+RMB, let the event propagate.
      return false;
    });

    // Create the touch buttons.
    this._touchButtons = new TouchButtons(this._settings);

    // Here we test whether any menus are configured. If the key is completely empty, this
    // is considered to be the same as "[]". If no menus are configured, the default
    // configuration is loaded.
    let json = this._settings.get_string('menu-configuration');
    if (json == '') {
      json = '[]';
    }

    // Try to parse the configuration.
    try {
      const config = JSON.parse(json);

      // If it's not an array something is wrong - the next call to
      // _onMenuConfigsChanged() will show an error. We load the default menu only if the
      // parsed element is an empty array.
      if (Array.isArray(config) && config.length == 0) {
        this._settings.set_string(
            'menu-configuration', JSON.stringify([DefaultMenu.get()]));
      }
    } catch (error) {
      // If parsing fails, we do nothing here - an error will be shown by the next call to
      // _onMenuConfigsChanged().
    }

    // This is called from the handlers below whenever the global hidpi-factor or the
    // global resource-scale factor changes.
    const onScaleChange = () => {
      this._menu.onSettingsChange();
      this._touchButtons.onSettingsChange();
      this._onScreencastMouseChanged();
    };

    // Call the above lambda whenever the global hidpi-factor or the global resource-scale
    // factor changes.
    const ctx                   = St.ThemeContext.get_for_stage(global.stage);
    this._scaleFactorConnection = ctx.connect('notify::scale-factor', onScaleChange);

    if (utils.shellVersionIsAtLeast(3, 38)) {
      this._resourceScaleConnection =
          global.stage.connect('resource-scale-changed', onScaleChange);
    }

    // Whenever settings are changed, we adapt the currently shown menu accordingly.
    this._settingsConnections.push(this._settings.connect('change-event', (o, keys) => {
      // For historical reasons, all settings of Fly-Pie are included in one schema. This
      // is a bit unfortunate, as we cannot easily listen only for appearance changes, as
      // all statistics are included in the schema as well. To avoid reconfiguration of
      // the menu if a statistics key changes, we have to manual filter here.
      if (Statistics.getInstance().containsAnyNonStatsKey(keys)) {
        this._menu.onSettingsChange();
        this._touchButtons.onSettingsChange(keys);
      }

      return false;
    }));

    // Reload the menu configuration when the settings key changes.
    this._settingsConnections.push(this._settings.connect(
        'changed::menu-configuration', () => this._onMenuConfigsChanged()));
    this._onMenuConfigsChanged();

    // Show or hide screencast mouse if the corresponding settings key is toggled.
    this._settingsConnections.push(this._settings.connect(
        'changed::show-screencast-mouse', () => this._onScreencastMouseChanged()));
    this._onScreencastMouseChanged();

    // Show notifications whenever a level-up occurred. In fact, this will be shown also
    // when a level-down happened, but this should only happen rarely...
    this._achievements = new Achievements(this._settings);
    this._achievements.connect('level-changed', (o, level) => {
      this._notify(
          // Translators: This is shown in a desktop notifications.
          _('Fly-Pie Level Up!'),
          // Translators: This is shown in a desktop notifications.
          _('You reached level %i!').replace('%i', level),
          GdkPixbuf.Pixbuf.new_from_resource(`/img/levels/level${level}.png`));
    });

    // Show notifications whenever achievements are unlocked.
    this._achievements.connect('completed', (o, id) => {
      const achievement = o.getAchievements().get(id);

      // Create an icon for the achievement notification.
      const surface = new Cairo.ImageSurface(Cairo.Format.ARGB32, 64, 64);
      const ctx     = new Cairo.Context(surface);
      Achievements.paintAchievementIcon(ctx, achievement);
      const icon = Gdk.pixbuf_get_from_surface(surface, 0, 0, 64, 64);

      // Explicitly tell Cairo to free the context memory.
      // https://wiki.gnome.org/Projects/GnomeShell/Extensions/TipsOnMemoryManagement#Cairo
      ctx.$dispose();

      this._notify(
          // Translators: This is shown in a desktop notifications.
          _('Fly-Pie Achievement Completed!'),
          // Translators: This is shown in a desktop notifications.
          _('You finished the achievement "%s"!').replace('%s', achievement.name), icon);

      // Whenever an achievement is unlocked, this counter is increased by one. It is used
      // to show a small badge in the achievements dialog containing the number of newly
      // achieved achievements.
      const key = 'stats-unread-achievements';
      this._settings.set_uint(key, this._settings.get_uint(key) + 1);
    });
  }

  // Cleans up stuff which is not cleaned up automatically.
  destroy() {

    // Disable animations again (if no hardware acceleration was available).
    if (global.backend && !global.backend.is_rendering_hardware_accelerated()) {
      St.Settings.get().inhibit_animations();
    }

    // Delete the clipboard manager singleton. This is used by the clipboard menu.
    ClipboardManager.destroyInstance();

    // Delete the touch buttons.
    this._touchButtons.destroy();

    this._menu.destroy();

    this._dbus.flush();
    this._dbus.unexport();

    this._shortcuts.destroy();

    this._settingsConnections.forEach(connection => {
      this._settings.disconnect(connection);
    });

    this._achievements.destroy();

    // Hide the screencast mouse pointer (if any).
    if (this._screencastMouse) {
      this._screencastMouse.destroy();
      global.stage.remove_child(this._screencastMouse);
    }

    // Delete the statistics singleton.
    Statistics.destroyInstance();

    // Unregister our resources.
    Gio.resources_unregister(this._resources);

    // Disconnect some handlers.
    global.stage.disconnect(this._resourceScaleConnection);

    if (utils.shellVersionIsAtLeast(3, 38)) {
      St.ThemeContext.get_for_stage(global.stage).disconnect(this._scaleFactorConnection);
    }
  }

  // -------------------------------------------------------------- public D-Bus-Interface

  // This opens a menu configured with Fly-Pie's menu editor and can be directly called
  // over the D-Bus. See the README.md for a description of Fly-Pie's DBusInterface. If
  // there are more than one menu with the same name, the first will be opened.
  ShowMenu(name) {
    return this.ShowMenuAt(name, null, null);
  }

  // Same as above, but instead at the pointer location, the menu will be opened at the
  // given pixel coordinates.
  ShowMenuAt(name, x, y) {
    return this._openMenu(name, false, x, y);
  }

  // Opens a menu with that name if there are currently none open. Closes the currently
  // open menu otherwise.
  ToggleMenu(name) {
    if (this._menu.getID() == null) {
      return this.ShowMenu(name);
    }

    this.CancelMenu();

    return DBusInterface.errorCodes.eHadToCancelAMenu;
  }

  // This opens a menu configured with Fly-Pie's menu editor in preview mode and can be
  // directly called over the D-Bus. See the README.md for a description of Fly-Pie's
  // DBusInterface. If there are more than one menu with the same name, the first will be
  // opened.
  PreviewMenu(name) {
    return this._openMenu(name, true, null, null);
  }

  // This opens a custom menu and can be directly called over the D-Bus.
  // See the README.md for a description of Fly-Pie's DBusInterface.
  ShowCustomMenu(json) {
    return this.ShowCustomMenuAt(json, null, null);
  }

  // Same as above, but instead at the pointer location, the menu will be opened at the
  // given pixel coordinates.
  ShowCustomMenuAt(json, x, y) {
    this._lastMenuID = this._getNextMenuID(this._lastMenuID);
    Statistics.getInstance().addCustomDBusMenu();
    return this._openCustomMenu(json, false, this._lastMenuID, x, y);
  }

  // This opens a custom menu in preview mode and can be directly called over the D-Bus.
  // See the README.md for a description of Fly-Pie's DBusInterface.
  PreviewCustomMenu(json) {
    this._lastMenuID = this._getNextMenuID(this._lastMenuID);
    Statistics.getInstance().addCustomDBusMenu();
    return this._openCustomMenu(json, true, this._lastMenuID, null, null);
  }

  // This closes the currently open menu (if any).
  CancelMenu() {
    if (this._menu.getID() == null) {
      return DBusInterface.errorCodes.eNoActiveMenu;
    }

    this._menu.cancel();
    this._menu.close();

    return 0;
  }

  // This selects an item in the currently opened menu.
  // See the README.md for a description of Fly-Pie's DBusInterface.
  SelectItem(path) {
    return this._menu.selectItem(path);
  }

  // ----------------------------------------------------------------------- private stuff

  // Opens a menu configured with Fly-Pie's menu editor, optionally in preview mode. The
  // menu's name must be given as parameter. It will return a positive number on success
  // and a negative on failure. See common/DBusInterface.js for a list of error codes.
  _openMenu(name, previewMode, x, y) {

    // Search for the meu with the given name.
    for (let i = 0; i < this._menuConfigs.length; i++) {

      if (name == this._menuConfigs[i].name) {

        // Once we found the desired menu, we can open the menu with the custom-menu
        // method.
        return this._openCustomMenu(
            this._menuConfigs[i], previewMode, this._menuConfigs[i].id, x, y);
      }
    }

    // There is no menu with such a name.
    return DBusInterface.errorCodes.eNoSuchMenu;
  }

  // Open the menu described by 'config', optionally in preview mode. 'config' can either
  // be a JSON string or an object containing the menu configuration. This method will
  // return the menu's ID on success or an error code on failure. See
  // common/DBusInterface.js for a list of error codes.
  _openCustomMenu(config, previewMode, menuID, x, y) {

    // First try to parse the menu configuration if it's given as a json string.
    if (typeof config === 'string') {
      try {
        config = JSON.parse(config);
      } catch (error) {
        utils.debug('Failed to parse menu configuration JSON: ' + error);
        return DBusInterface.errorCodes.eInvalidJSON;
      }
    }

    // Then normalize the menu configuration (e.g. add all default data).
    try {
      ItemRegistry.normalizeConfig(config);
    } catch (error) {
      utils.debug('Failed to parse menu configuration: ' + error);
      return DBusInterface.errorCodes.eInvalidMenuConfiguration;
    }

    // Then try to transform the menu configuration to a menu structure. See
    // ItemRegistry.js for details.
    let structure;
    try {
      structure = ItemRegistry.transformConfig(config);
    } catch (error) {
      utils.debug('Failed to transform menu configuration: ' + error);
      return DBusInterface.errorCodes.eInvalidMenuConfiguration;
    }

    // Then try to open the menu. This will return the menu's ID on success or an error
    // code on failure.
    try {
      return this._menu.open(menuID, structure, previewMode, x, y);
    } catch (error) {
      utils.debug('Failed to show menu: ' + error);
    }

    // Something weird happened.
    return DBusInterface.errorCodes.eUnknownError;
  }

  // This gets called whenever the user starts hovering an action in point-and-click
  // mode or starts dragging an action in marking mode. It emits the OnHover signal of
  // our D-Bus interface.
  _onHover(menuID, itemID) {
    this._dbus.emit_signal('OnHover', GLib.Variant.new('(is)', [menuID, itemID]));
  }

  // This gets called whenever the user stops hovering an action in point-and-click
  // mode or stops dragging an action in marking mode. It emits the OnUnhover signal of
  // our D-Bus interface.
  _onUnhover(menuID, itemID) {
    this._dbus.emit_signal('OnUnhover', GLib.Variant.new('(is)', [menuID, itemID]));
  }

  // This gets called once the user made a selection in the menu. It emit the OnSelect
  // signal of our D-Bus interface.
  _onSelect(menuID, itemID) {
    this._dbus.emit_signal('OnSelect', GLib.Variant.new('(is)', [menuID, itemID]));
  }

  // This gets called when the user did not select anything in the menu. It emits the
  // OnCancel signal of our D-Bus interface.
  _onCancel(menuID) {
    Statistics.getInstance().addAbortion();
    this._dbus.emit_signal('OnCancel', GLib.Variant.new('(i)', [menuID]));
  }

  // Whenever the menu configuration changes, we check for any new shortcuts which need to
  // be bound.
  _onMenuConfigsChanged() {

    // Try to load the new menu configuration.
    try {
      this._menuConfigs = JSON.parse(this._settings.get_string('menu-configuration'));
    } catch (error) {
      utils.debug('Failed to load Fly-Pie menu configuration: ' + error);
      this._menuConfigs = [];
    }

    // Root element must be an array of menus.
    if (!Array.isArray(this._menuConfigs)) {
      utils.debug(
          'Failed to load Fly-Pie menu configuration: Root element must be an array!');
      this._menuConfigs = [];
    }

    // Update touch buttons --------------------------------------------------------------

    this._touchButtons.setMenuConfigs(this._menuConfigs);

    // Update currently bound global shortcuts -------------------------------------------

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

    // Update currently shown menu (if any) ----------------------------------------------

    // There is currently a menu open, so we potentially have to update the displayed
    // menu.
    if (this._menu.getID() != null) {
      for (let i = 0; i < this._menuConfigs.length; i++) {
        if (this._menuConfigs[i].id == this._menu.getID()) {
          // Transform the configuration into a menu structure.
          ItemRegistry.normalizeConfig(this._menuConfigs[i]);
          const structure = ItemRegistry.transformConfig(this._menuConfigs[i]);

          // Once we transformed the menu configuration to a menu structure, we can update
          // the menu with the new structure.
          const result = this._menu.update(structure);

          // If that was successful, we are done.
          if (result >= 0) {
            return;
          }

          break;
        }
      }

      // Something went wrong in updating the preview. Let's hide it.
      this._onCancel(this._menu.getID());
      this._menu.close();
    }
  }

  // This returns a new ID for a custom show-menu request. The last ID is increased by, if
  // the result collides with an ID of a menu configured with Fly-Pie's menu editor, it
  // is increased once more.
  _getNextMenuID(lastID) {
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

  // This enables / disables the additional mouse pointer for screencasts. It is simply
  // created as a child of the global.stage.
  _onScreencastMouseChanged() {
    if (this._screencastMouse) {
      this._screencastMouse.destroy();
      delete this._screencastMouse;
    }

    if (this._settings.get_boolean('show-screencast-mouse')) {

      // For now, we use a hard-coded size of 50. This can be made configurable in the
      // future if anybody needs it.
      const size            = 50 * utils.getHDPIScale();
      this._screencastMouse = new MouseHighlight(size);
      global.stage.add_child(this._screencastMouse);
    }
  }

  // Shows a GNOME Shell notification with the given label, description and icon. The size
  // of the icon seems to depend on the currently used theme and cannot be set from here.
  // The notification will also contain a hard-coded button which opens the achievements
  // page of the settings dialog.
  _notify(label, details, gicon) {

    if (this._settings.get_boolean('achievement-notifications')) {
      const source = new Main.MessageTray.Source('Fly-Pie', '');
      Main.messageTray.add(source);

      const n = new Main.MessageTray.Notification(source, label, details, {gicon: gicon});

      // Translators: This is shown on the action button of the notification bubble which
      // is shown once an achievement is unlocked.
      n.addAction(_('Show Achievements'), () => {
        // Make sure the achievements page is shown.
        this._settings.set_string('active-stack-child', 'achievements-page');

        // Show the settings dialog.
        Main.extensionManager.openExtensionPrefs(Me.uuid, '');
      });

      source.showNotification(n);
    }
  }
};