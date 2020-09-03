//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const {Gio, GLib, Gdk, Gtk, GMenu} = imports.gi;

const ByteArray = imports.byteArray;
const Me        = imports.misc.extensionUtils.getCurrentExtension();
const utils     = Me.imports.common.utils;

// We import Shell and InputManipulator optionally. When this file is included from the
// client side, these are available and can be used in the activation code of the actions
// defined below. If this file is included via the pref.js, both of these are not
// available. But this is not a problem, as the preferences will not call the createItem()
// methods below; they are merely interested in the different item type's names, icons and
// descriptions.
let Shell            = undefined;
let InputManipulator = undefined;

try {
  Shell            = imports.gi.Shell;
  InputManipulator = new Me.imports.common.InputManipulator.InputManipulator();
} catch (error) {
  // Nothing to be done, we're in settings-mode.
}

//////////////////////////////////////////////////////////////////////////////////////////
// Each item type has one settings type - this determines which widgets are visible     //
// when an item of this type is selected in the settings dialog. If you create a new    //
// item type, this list may have to be extended. This will also require some changes to //
// the MenuEditor.js as this is responsible for showing and hiding the widgets          //
// accordingly.                                                                         //
//////////////////////////////////////////////////////////////////////////////////////////

var SettingsTypes = {
  NONE: 0,
  MENU: 1,
  SUBMENU: 2,
  SHORTCUT: 3,
  COMMAND: 4,
  FILE: 5,
  URL: 6,
  COUNT: 7,
  TEXT: 8,
};

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

var ItemTypes = {

  // The top-level menu cannot be activated. It should always contain some children.
  Menu: {
    name: 'Toplevel Menu',
    icon: 'view-more-symbolic',
    defaultData: '',
    subtitle: 'Create as many as you want!',
    description:
        'A <b>Toplevel Menu</b> can contain any number of menu items and submenus. However, for precise item selection, a maximum number of twelve items is recommended.\nThe menu can be opened using the shortcut defined above. It is also possible to open a menu with a terminal command. You can read more on <a href="https://github.com/Schneegans/Fly-Pie">Github</a>.',
    settingsType: SettingsTypes.MENU,
    settingsList: 'menu-types-list',
    createItem: (name, icon, centered) => {
      return {name: name, icon: icon, centered: centered, children: []};
    }
  },

  // The hotkey action simulates the pressing of a hotkey when activated.
  Shortcut: {
    name: 'Activate Shortcut',
    icon: 'accessories-character-map',
    defaultData: '',
    subtitle: 'Simulates a key stroke.',
    description:
        'The <b>Activate Shortcut</b> action simulates a key stroke when activated. For example, this can be used to switch virtual desktops, control multimedia playback or to undo / redo operations',
    settingsType: SettingsTypes.SHORTCUT,
    settingsList: 'action-types-list',
    createItem: (name, icon, angle, data) => {
      return {
        name: name,
        icon: icon,
        angle: angle,
        activate: () => {
          InputManipulator.activateAccelerator(data);
        }
      };
    }
  },

  // The hotkey action simulates the pressing of a hotkey when activated.
  InsertText: {
    name: 'Insert Text',
    icon: 'input-keyboard',
    defaultData: '',
    subtitle: 'Types some text.',
    description:
        'The <b>Insert Text</b> action copies the given text to the clipboard and then simulates a Ctrl+V. This can be useful if you realize that you often write the same things.',
    settingsType: SettingsTypes.TEXT,
    settingsList: 'action-types-list',
    createItem: (name, icon, angle, data) => {
      return {
        name: name,
        icon: icon,
        angle: angle,
        activate: () => {
          const clipboard = Gtk.Clipboard.get_default(Gdk.Display.get_default());
          clipboard.set_text(data, -1);
          InputManipulator.activateAccelerator('<Primary>v');
        }
      };
    }
  },

  // The command actions executes a shell command when activated. This can be used to
  // launch any application installed in the $PATH.
  Command: {
    name: 'Launch Application',
    icon: 'utilities-terminal',
    defaultData: '',
    subtitle: 'Runs any shell command.',
    description:
        'The <b>Launch Application</b> action executes any given command. This is primarily used to open applications but may have plenty of other use cases as well.',
    settingsType: SettingsTypes.COMMAND,
    settingsList: 'action-types-list',
    createItem: (name, icon, angle, data) => {
      return {
        name: name,
        icon: icon,
        angle: angle,
        activate: () => {
          try {
            const ctx  = global.create_app_launch_context(0, -1);
            const item = Gio.AppInfo.create_from_commandline(
                data, null, Gio.AppInfoCreateFlags.NONE);
            item.launch([], ctx);
          } catch (error) {
            utils.notification('Failed to execute command: ' + error);
          }
        }
      };
    }
  },

  // The Url action opens the define URL in the system's default web browser. Despite its
  // name it can actually open any URI.
  Uri: {
    name: 'Open URI',
    icon: 'applications-internet',
    defaultData: 'https://github.com/Schneegans/Fly-Pie',
    subtitle: 'Opens an URI with the default applications.',
    description:
        'When the <b>Open URI</b> action is activated, the above URI is opened with the default application. For http URLs, this will be your web browser. However, it is also possible to open other URIs such as "mailto:foo@bar.org".',
    settingsType: SettingsTypes.URL,
    settingsList: 'action-types-list',
    createItem: (name, icon, angle, data) => {
      return {
        name: name,
        icon: icon,
        angle: angle,
        activate: () => {
          try {
            Gio.AppInfo.launch_default_for_uri(data, null);
          } catch (error) {
            utils.notification('Failed to open URL: ' + error);
          }
        }
      };
    }
  },

  // The file action is very similar to the Url action, but only works for files. But it's
  // a bit more intuitive as the leading file:// is not required.
  File: {
    name: 'Open File',
    icon: 'text-x-generic',
    defaultData: '',
    subtitle: 'Opens a file with the default applications.',
    description:
        'The <b>Open File</b> action will open the above specified file with your system\'s default application.',
    settingsType: SettingsTypes.FILE,
    settingsList: 'action-types-list',
    createItem: (name, icon, angle, data) => {
      return {
        name: name,
        icon: icon,
        angle: angle,
        activate: () => {
          try {
            Gio.AppInfo.launch_default_for_uri('file://' + data, null);
          } catch (error) {
            utils.notification('Failed to open file: ' + error);
          }
        }
      };
    }
  },

  ////////////////////////////////////////////////////////////////////////////////////////
  // Items below this line are submenus, that means they contain usually more than one  //
  // item. Usually the items are dynamic and may be different from time to time.        //
  ////////////////////////////////////////////////////////////////////////////////////////

  // Submenus cannot be activated. They should always contain some children.
  Submenu: {
    name: 'Custom Submenu',
    icon: 'view-more-horizontal-symbolic',
    defaultData: '',
    subtitle: 'Add structure to your menu!',
    description:
        'The <b>Custom Submenu</b> can be used to group actions together. As deep hierarchies can be selected quite efficiently, feel free to create submenus in submenus!',
    settingsType: SettingsTypes.SUBMENU,
    settingsList: 'submenu-types-list',
    createItem: (name, icon, angle, data) => {
      return {name: name, icon: icon, angle: angle, children: []};
    }
  },

  // The devices submenu contains an item for each mounted volume as reported by the
  // Gio.VolumeMonitor.
  Devices: {
    name: 'Devices',
    icon: 'drive-harddisk',
    defaultData: '',
    subtitle: 'Shows connected devices.',
    description:
        'The <b>Devices</b> submenu shows an item for each mounted volume, like USB-Sticks.',
    settingsType: SettingsTypes.NONE,
    settingsList: 'submenu-types-list',
    createItem: (name, icon, angle, data) => {
      const result  = {name: name, icon: icon, angle: angle, children: []};
      const monitor = Gio.VolumeMonitor.get();

      // Add a child item for each mounted volume.
      monitor.get_mounts().forEach(mount => {
        result.children.push({
          name: mount.get_name(),
          icon: mount.get_icon().to_string(),
          activate: () => {
            try {
              const ctx = global.create_app_launch_context(0, -1);
              Gio.AppInfo.launch_default_for_uri(mount.get_root().get_uri(), ctx);
            } catch (error) {
              utils.notification(
                  'Failed to open "%s": %s'.format(mount.get_name(), error));
            }
          }
        });
      });

      return result;
    }
  },

  // The bookmarks submenu contains one entry for the default user directories.
  Bookmarks: {
    name: 'Bookmarks',
    icon: 'folder',
    defaultData: '',
    subtitle: 'Shows your commonly used directories.',
    description:
        'The <b>Bookmarks</b> submenu shows an item for the trash, your desktop and each bookmarked directory.',
    settingsType: SettingsTypes.NONE,
    settingsList: 'submenu-types-list',
    createItem: (name, icon, angle, data) => {
      // Adds an action for the given (file://) uri to the children list of the given menu
      // item. The name parameter is optional and will be used if given. Else the name of
      // the file defined by the uri is used.
      const pushForUri = (menu, uri, name) => {
        // First check wether the file actually exists.
        const file = Gio.File.new_for_uri(uri);
        if (file.query_exists(null)) {

          // If no name is given, query the display name.
          if (name == undefined) {
            try {
              const info = file.query_info('standard::display-name', 0, null);
              name       = info.get_display_name();
            } catch (e) {
              name = file.get_basename();
            }
          }

          // Try tgo retrieve an icon for the file.
          let icon = 'image-missing';
          try {
            const info = file.query_info('standard::icon', 0, null);
            icon       = info.get_icon().to_string();
          } catch (e) {
          }

          // Push the new item.
          menu.children.push({
            name: name,
            icon: icon,
            activate: () => {
              // Open the file with the default application.
              try {
                const ctx = global.create_app_launch_context(0, -1);
                Gio.AppInfo.launch_default_for_uri(uri, ctx);
              } catch (error) {
                utils.notification('Failed to open "%s": %s'.format(this.name, error));
              }
            }
          });
        }
      };

      // Create the submenu for all the bookmarks.
      const result = {name: name, icon: icon, angle: angle, children: []};

      // Add the trash entry.
      pushForUri(result, 'trash://');

      // Add the home entry.
      pushForUri(result, 'file://' + GLib.get_home_dir());

      // Add the desktop entry.
      pushForUri(
          result,
          'file://' + GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DESKTOP));

      // Read the gtk bookmarks file and add an entry for each line.
      const bookmarksFile = GLib.get_home_dir() + '/.config/gtk-3.0/bookmarks';
      try {
        const [ok, bookmarks] = GLib.file_get_contents(bookmarksFile);

        if (ok) {
          // Split the content at line breaks.
          ByteArray.toString(bookmarks).split(/\r?\n/).forEach(uri => {
            // Some lines contain an alias for the bookmark. This alias starts at the
            // first space of the line.
            const firstSpace = uri.indexOf(' ');

            if (firstSpace >= 0) {
              pushForUri(result, uri.slice(0, firstSpace), uri.slice(firstSpace + 1));
            } else {
              pushForUri(result, uri);
            }
          });
        }
      } catch (error) {
        utils.debug(error);
      }

      return result;
    }
  },

  // Returns an item with entries for all running applications. Clicking these will bring
  // the corresponding app to the foreground. Like Alt-Tab.
  RunningApps: {
    name: 'Running Apps',
    icon: 'preferences-system-windows',
    defaultData: '',
    subtitle: 'Shows the currently running applications.',
    description:
        'The <b>Running Apps</b> submenu shows all currently running applications. This is similar to the Alt+Tab window selection. As the entries change position frequently, this is actually not very effective.',
    settingsType: SettingsTypes.NONE,
    settingsList: 'submenu-types-list',
    createItem: (name, icon, angle, data) => {
      const apps   = Shell.AppSystem.get_default().get_running();
      const result = {name: name, icon: icon, angle: angle, children: []};

      for (let i = 0; i < apps.length; ++i) {
        let icon = 'image-missing';
        try {
          icon = apps[i].get_app_info().get_icon().to_string();
        } catch (e) {
        }
        const windows = apps[i].get_windows();
        windows.forEach(window => {
          result.children.push({
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
    defaultData: '7',
    subtitle: 'Shows your recently used files.',
    description:
        'The <b>Recent Files</b> submenu shows a list of recently used files. You should limit the maximum number of shown files to a reasonable number.',
    settingsType: SettingsTypes.COUNT,
    settingsList: 'submenu-types-list',
    createItem: (name, icon, angle, data) => {
      const maxNum      = parseInt(data);
      const recentFiles = Gtk.RecentManager.get_default().get_items().slice(0, maxNum);
      const result      = {name: name, icon: icon, angle: angle, children: []};

      recentFiles.forEach(recentFile => {
        if (recentFile.exists()) {
          result.children.push({
            name: recentFile.get_display_name(),
            icon: recentFile.get_gicon().to_string(),
            activate: () => {
              const ctx = global.create_app_launch_context(0, -1);

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
  // Gnome Shell.
  FrequentlyUsed: {
    name: 'Frequently Used',
    icon: 'emblem-favorite',
    defaultData: '7',
    subtitle: 'Shows your frequently used applications.',
    description:
        'The <b>Frequently Used</b> submenu shows a list of frequently used applications. You should limit the maximum number of shown applications to a reasonable number.',
    settingsType: SettingsTypes.COUNT,
    settingsList: 'submenu-types-list',
    createItem: (name, icon, angle, data) => {
      const maxNum = parseInt(data);
      const apps   = Shell.AppUsage.get_default().get_most_used().slice(0, maxNum);
      const result = {name: name, icon: icon, angle: angle, children: []};

      apps.forEach(app => {
        if (app) {
          result.children.push({
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
  // Gnome Shell.
  Favorites: {
    name: 'Favorites',
    icon: 'starred',
    defaultData: '',
    subtitle: 'Shows your pinned applications.',
    description:
        'The <b>Favorites</b> submenu the applications you have pinned to Gnome Shell\'s Dash.',
    settingsType: SettingsTypes.NONE,
    settingsList: 'submenu-types-list',
    createItem: (name, icon, angle, data) => {
      const appNames = global.settings.get_strv('favorite-apps');
      const result   = {name: name, icon: icon, angle: angle, children: []};

      appNames.forEach(appName => {
        const app = Shell.AppSystem.get_default().lookup_app(appName);

        if (app) {
          result.children.push({
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
    defaultData: '',
    subtitle: 'Shows all installed applications.',
    description:
        'The <b>Main Menu</b> shows all installed applications. Usually, this is very cluttered as many sections contain too many items to be used efficiently. You should rather setup your own menus!',
    settingsList: 'submenu-types-list',
    settingsType: SettingsTypes.NONE,
    createItem: (name, icon, angle, data) => {
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
                    utils.notification('Failed to launch app: ' + error);
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


      const menu = new GMenu.Tree(
          {menu_basename: 'applications.menu', flags: GMenu.TreeFlags.NONE});

      menu.load_sync();

      const result = {name: name, icon: icon, angle: angle, children: []};

      pushMenuItems(result, menu.get_root_directory());

      return result;
    }
  }
};
