//////////////////////////////////////////////////////////////////////////////////////////
//   _____       _             _____ _                                                  //
//  |   __|_ _ _|_|___ ___ ___|  _  |_|___   This software may be modified and distri-  //
//  |__   | | | | |   | . |___|   __| | -_|  buted under the terms of the MIT license.  //
//  |_____|_____|_|_|_|_  |   |__|  |_|___|  See the LICENSE file for details.          //
//                    |___|                                                             //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const {Gio, GLib, Gtk, GMenu} = imports.gi;

const Me    = imports.misc.extensionUtils.getCurrentExtension();
const utils = Me.imports.common.utils;

let Shell            = undefined;
let InputManipulator = undefined;
try {
  Shell            = imports.gi.Shell;
  InputManipulator = new Me.imports.common.InputManipulator.InputManipulator();
} catch (error) {
}

var ItemSettingsType = {NONE: 0, HOTKEY: 1, COMMAND: 2, FILE: 3, URL: 4, COUNT: 5};

//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////

var ItemTypes = {
  Hotkey: {
    name: 'Press Hotkey',
    icon: 'accessories-character-map',
    description: 'Simulates a key stroke.',
    settingsType: ItemSettingsType.HOTKEY,
    settingsList: 'action-types-list',
    createItem: (name, icon, hotkey) => {
      return {
        name: name,
        icon: icon,
        activate: () => {
          InputManipulator.activateAccelerator(hotkey);
        }
      };
    }
  },
  Command: {
    name: 'Launch Application',
    icon: 'utilities-terminal',
    description: 'Runs any shell command.',
    settingsType: ItemSettingsType.COMMAND,
    settingsList: 'action-types-list',
    createItem: (name, icon, command) => {
      return {
        name: name,
        icon: icon,
        activate: () => {
          try {
            let ctx    = global.create_app_launch_context(0, -1);
            const item = Gio.AppInfo.create_from_commandline(
                command, null, Gio.AppInfoCreateFlags.NONE);
            item.launch([], ctx);
          } catch (error) {
            utils.notification('Failed to execute command: ' + error);
          }
        }
      };
    }
  },
  Url: {
    name: 'Open URL',
    icon: 'applications-internet',
    description: 'Opens an URL with the default browser.',
    settingsType: ItemSettingsType.URL,
    settingsList: 'action-types-list',
    createItem: (name, icon, url) => {
      return {
        name: name,
        icon: icon,
        activate: () => {
          try {
            Gio.AppInfo.launch_default_for_uri(url, null);
          } catch (error) {
            utils.notification('Failed to open URL: ' + error);
          }
        }
      };
    }
  },
  File: {
    name: 'Open File',
    icon: 'text-x-generic',
    description: 'Opens a file with the default applications.',
    settingsType: ItemSettingsType.FILE,
    settingsList: 'action-types-list',
    createItem: (name, icon, file) => {
      return {
        name: name,
        icon: icon,
        activate: () => {
          try {
            Gio.AppInfo.launch_default_for_uri('file://' + file, null);
          } catch (error) {
            utils.notification('Failed to open file: ' + error);
          }
        }
      };
    }
  },

  //////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////

  Bookmarks: {
    name: 'Bookmarks',
    icon: 'folder',
    description: 'Shows your commonly used directories.',
    settingsType: ItemSettingsType.NONE,
    settingsList: 'submenu-types-list',
    createItem: (name, icon) => {
      const pushFile = (menu, file) => {
        let name, icon;
        try {
          const info = file.query_info('standard::display-name', 0, null);
          name       = info.get_display_name();
        } catch (e) {
          name = file.get_basename();
        }

        try {
          const info = file.query_info('standard::icon', 0, null);
          icon       = info.get_icon().to_string();
        } catch (e) {
          icon = 'missing-image';
        }

        menu.items.push({
          name: name,
          icon: icon,
          activate: () => {
            let ctx = global.create_app_launch_context(0, -1);

            try {
              Gio.AppInfo.launch_default_for_uri(file.get_uri(), ctx);
            } catch (error) {
              utils.notification('Failed to open "%s": %s'.format(this.name, error));
            }
          }
        });
      };

      let result = {name: name, icon: icon, items: []};

      pushFile(result, Gio.File.new_for_path(GLib.get_home_dir()));

      const DEFAULT_DIRECTORIES = [
        GLib.UserDirectory.DIRECTORY_DESKTOP, GLib.UserDirectory.DIRECTORY_DOCUMENTS,
        GLib.UserDirectory.DIRECTORY_DOWNLOAD, GLib.UserDirectory.DIRECTORY_MUSIC,
        GLib.UserDirectory.DIRECTORY_PICTURES, GLib.UserDirectory.DIRECTORY_TEMPLATES,
        GLib.UserDirectory.DIRECTORY_PUBLIC_SHARE, GLib.UserDirectory.DIRECTORY_VIDEOS
      ];

      for (let i = 0; i < DEFAULT_DIRECTORIES.length; ++i) {
        let path = GLib.get_user_special_dir(DEFAULT_DIRECTORIES[i]);
        pushFile(result, Gio.File.new_for_path(path));
      }

      return result;
    }
  },

  // Returns an item with entries for all running applications. Clicking these will bring
  // the corresponding app to the foreground. Like Alt-Tab.
  RunningApps: {
    name: 'Running Apps',
    icon: 'preferences-system-windows',
    description: 'Shows the currently running applications.',
    settingsType: ItemSettingsType.NONE,
    settingsList: 'submenu-types-list',
    createItem: (name, icon) => {
      let apps   = Shell.AppSystem.get_default().get_running();
      let result = {name: name, icon: icon, items: []};

      for (let i = 0; i < apps.length; ++i) {
        let windows = apps[i].get_windows();
        let icon    = apps[i].get_app_info().get_icon().to_string();
        windows.forEach(window => {
          result.items.push({
            name: window.get_title(),
            icon: icon,
            activate: () => window.activate(0 /*timestamp*/)
          });
        });
      }

      return result;
    }
  },

  // Returns an item with entries for each recently used file, as reported by
  // Gtk.RecentManager.
  RecentFiles: {
    name: 'Recent Files',
    icon: 'document-open-recent',
    description: 'Shows your recently used files.',
    settingsType: ItemSettingsType.COUNT,
    settingsList: 'submenu-types-list',
    createItem: (name, icon, maxNum) => {
      let recentFiles = Gtk.RecentManager.get_default().get_items().slice(0, maxNum);
      let result      = {name: name, icon: icon, items: []};

      recentFiles.forEach(recentFile => {
        if (recentFile.exists()) {
          result.items.push({
            name: recentFile.get_display_name(),
            icon: recentFile.get_gicon().to_string(),
            activate: () => {
              let ctx = global.create_app_launch_context(0, -1);

              try {
                Gio.AppInfo.launch_default_for_uri(recentFile.get_uri(), ctx);
              } catch (error) {
                utils.notification('Failed to open URI: ' + error);
              }
            }
          });
        }
      });

      return result;
    }
  },

  // Returns an item with entries for each "frequently used application", as reported by
  // Gnome-Shell.
  FrequentlyUsed: {
    name: 'Frequently Used',
    icon: 'emblem-default',
    description: 'Shows your frequently used applications.',
    settingsType: ItemSettingsType.COUNT,
    settingsList: 'submenu-types-list',
    createItem: (name, icon, maxNum) => {
      let apps   = Shell.AppUsage.get_default().get_most_used().slice(0, maxNum);
      let result = {name: name, icon: icon, items: []};

      apps.forEach(app => {
        if (app) {
          result.items.push({
            name: app.get_name(),
            icon: app.get_app_info().get_icon().to_string(),
            activate: () => app.open_new_window(-1)
          });
        }
      });

      return result;
    }
  },

  // Returns an item with entries for each "favorite application", as reported by
  // Gnome-Shell.
  Favorites: {
    name: 'Favorites',
    icon: 'emblem-favorite',
    description: 'Shows your pinned applications.',
    settingsType: ItemSettingsType.NONE,
    settingsList: 'submenu-types-list',
    createItem: (name, icon) => {
      let appNames = global.settings.get_strv('favorite-apps');
      let result   = {name: name, icon: icon, items: []};

      appNames.forEach(appName => {
        const app = Shell.AppSystem.get_default().lookup_app(appName);

        if (app) {
          result.items.push({
            name: app.get_name(),
            icon: app.get_app_info().get_icon().to_string(),
            activate: () => app.open_new_window(-1)
          });
        }
      });

      return result;
    }
  },

  // Returns an item containing the menu tree of all installed applications.
  MainMenu: {
    name: 'Main Menu',
    icon: 'applications-system',
    description: 'Shows all installed applications.\n' +
        'Usually, this is very cluttered;\n' +
        'you should rather setup your own menus!',
    settingsList: 'submenu-types-list',
    settingsType: ItemSettingsType.NONE,
    createItem: (name, icon) => {
      const pushMenuItems = (menu, dir) => {
        let iter = dir.iter(), nodeType, item;

        while ((nodeType = iter.next()) !== GMenu.TreeItemType.INVALID) {
          switch (nodeType) {

            // Add an item for each application.
            case GMenu.TreeItemType.ENTRY:
              let app  = iter.get_entry().get_app_info();
              let icon = 'missing-image';
              if (app.get_icon()) {
                icon = app.get_icon().to_string();
              }
              item = {
                name: app.get_name(),
                icon: icon,
                activate: () => {
                  let ctx = global.create_app_launch_context(0, -1);

                  try {
                    app.launch([], ctx);
                  } catch (error) {
                    utils.notification('Failed to launch app: ' + error);
                  }
                }
              };
              menu.items.push(item);
              break;

            // Recursively add child items to directories.
            case GMenu.TreeItemType.DIRECTORY:
              let directory = iter.get_directory();
              item          = {
                name: directory.get_name(),
                icon: directory.get_icon().to_string(),
                items: []
              };

              pushMenuItems(item, directory);
              menu.items.push(item);
              break;

            // SEPARATOR, HEADER, ALIAS. skip for now.
            default:
              break;
          }
        }
      };


      let menu = new GMenu.Tree(
          {menu_basename: 'applications.menu', flags: GMenu.TreeFlags.NONE});

      menu.load_sync();

      let result = {name: name, icon: icon, items: []};

      pushMenuItems(result, menu.get_root_directory());

      return result;
    }
  }
};
