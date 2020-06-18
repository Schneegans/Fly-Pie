//////////////////////////////////////////////////////////////////////////////////////////
//   _____       _             _____ _                                                  //
//  |   __|_ _ _|_|___ ___ ___|  _  |_|___   This software may be modified and distri-  //
//  |__   | | | | |   | . |___|   __| | -_|  buted under the terms of the MIT license.  //
//  |_____|_____|_|_|_|_  |   |__|  |_|___|  See the LICENSE file for details.          //
//                    |___|                                                             //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Main                           = imports.ui.main;
const {Gtk, Gio, Shell, GLib, GMenu} = imports.gi;

const Me    = imports.misc.extensionUtils.getCurrentExtension();
const utils = Me.imports.common.utils;

//////////////////////////////////////////////////////////////////////////////////////////
// This is a small helper class for adding menu items for files to the menus created by //
// the MenuFactory class.                                                               //
//////////////////////////////////////////////////////////////////////////////////////////

var FileInfo = class FileInfo {

  // ------------------------------------------------------------ constructor / destructor

  constructor(file) {
    this._file = file;
  }

  // -------------------------------------------------------------------- public interface

  // Opens the file in the system's default application for this file type.
  openDefault() {
    let launchContext = global.create_app_launch_context(0, -1);

    try {
      Gio.AppInfo.launch_default_for_uri(this._file.get_uri(), launchContext);
    } catch (e) {
      Main.notifyError('Failed to open "%s"'.format(this.name), e.message);
    }
  }

  // Returns a string representation for an icon representing this file.
  getIcon() {
    try {
      let info = this._file.query_info('standard::icon', 0, null);
      return info.get_icon().to_string();
    } catch (e) {
      return 'missing-image';
    }
  }

  // Returns a name for the file which can be presented to the user.
  getName() {
    try {
      let info = this._file.query_info('standard::display-name', 0, null);
      return info.get_display_name();
    } catch (e) {
      return this._file.get_basename();
    }
  }
};

//////////////////////////////////////////////////////////////////////////////////////////
// This class contains several static methods which can be used to create some          //
// standard items for menus. This includes for example items for user directories,      //
// frequently used applications or currently running applications.                      //
//////////////////////////////////////////////////////////////////////////////////////////

var MenuFactory = class MenuFactory {

  // -------------------------------------------------------------------- public interface

  // Returns an item with entries for each user directory. Like Home, Desktop, Download,
  // Videos and so on.
  static getUserDirectoriesItems() {
    let result = {name: 'Places', icon: 'system-file-manager', items: []};

    this._pushFileInfo(result, new FileInfo(Gio.File.new_for_path(GLib.get_home_dir())));

    const DEFAULT_DIRECTORIES = [
      GLib.UserDirectory.DIRECTORY_DESKTOP, GLib.UserDirectory.DIRECTORY_DOCUMENTS,
      GLib.UserDirectory.DIRECTORY_DOWNLOAD, GLib.UserDirectory.DIRECTORY_MUSIC,
      GLib.UserDirectory.DIRECTORY_PICTURES, GLib.UserDirectory.DIRECTORY_TEMPLATES,
      GLib.UserDirectory.DIRECTORY_PUBLIC_SHARE, GLib.UserDirectory.DIRECTORY_VIDEOS
    ];

    for (let i = 0; i < DEFAULT_DIRECTORIES.length; ++i) {
      let path = GLib.get_user_special_dir(DEFAULT_DIRECTORIES[i]);
      this._pushFileInfo(result, new FileInfo(Gio.File.new_for_path(path)));
    }

    return result;
  }

  // Returns an item with entries for each recently used file, as reported by
  // Gtk.RecentManager.
  static getRecentItems() {
    let maxNum      = 9;
    let recentFiles = Gtk.RecentManager.get_default().get_items().slice(0, maxNum);
    let result      = {name: 'Recent', icon: 'document-open-recent', items: []};

    recentFiles.forEach(recentFile => {
      if (recentFile.exists()) {
        result.items.push({
          name: recentFile.get_display_name(),
          icon: recentFile.get_gicon().to_string(),
          activate: () => this._openUri(recentFile.get_uri())
        });
      }
    });

    return result;
  }

  // Returns an item with entries for each "favorite application", as reported by
  // Gnome-Shell.
  static getFavoriteItems() {
    let maxNum = 9;
    let apps   = global.settings.get_strv('favorite-apps').slice(0, maxNum);
    let result = {name: 'Favorites', icon: 'emblem-favorite', items: []};

    apps.forEach(app => {
      this._pushShellApp(result, Shell.AppSystem.get_default().lookup_app(app));
    });

    return result;
  }

  // Returns an item with entries for each "frequently used application", as reported by
  // Gnome-Shell.
  static getFrequentItems() {
    let maxNum = 9;
    let apps   = Shell.AppUsage.get_default().get_most_used().slice(0, maxNum);
    let result = {name: 'Frequently Used', icon: 'emblem-default', items: []};


    apps.forEach(app => {
      this._pushShellApp(result, app);
    });

    return result;
  }

  // Returns an item with entries for all running applications. Clicking these will bring
  // the corresponding app to the foreground. Like Alt-Tab.
  static getRunningAppsItems() {
    let apps   = Shell.AppSystem.get_default().get_running();
    let result = {name: 'Running Apps', icon: 'preferences-system-windows', items: []};

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

  // Returns an item containing the menu tree of all installed applications.
  static getAppMenuItems() {
    let menu =
        new GMenu.Tree({menu_basename: 'applications.menu', flags: GMenu.TreeFlags.NONE});

    menu.load_sync();

    let result = {name: 'Applications', icon: 'applications-system', items: []};

    this._pushMenuItems(result, menu.get_root_directory());

    return result;
  }

  // ----------------------------------------------------------------------- private stuff

  // This is used to recursively populate the item with all installed applications.
  static _pushMenuItems(menu, dir) {
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
          item = {name: app.get_name(), icon: icon, activate: () => this._launchApp(app)};
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

          this._pushMenuItems(item, directory);
          menu.items.push(item);
          break;

        // SEPARATOR, HEADER, ALIAS. skip for now.
        default:
          break;
      }
    }
  }

  // This adds an entry for a Shell.App. Clicking the item will open a new window for the
  // given App.
  static _pushShellApp(menu, app) {
    if (app) {
      menu.items.push({
        name: app.get_name(),
        icon: app.get_app_info().get_icon().to_string(),
        activate: () => app.open_new_window(-1)
      });
    }
  }

  // Adds an item for the given FileInfo object. The FileInfo class is defined at the top
  // of this file.
  static _pushFileInfo(menu, file) {
    menu.items.push(
        {name: file.getName(), icon: file.getIcon(), activate: () => file.openDefault()});
  }

  // Uses the system's default application for opening the given URI.
  static _openUri(uri) {
    let ctx = global.create_app_launch_context(0, -1);

    try {
      Gio.AppInfo.launch_default_for_uri(uri, ctx);
    } catch (e) {
      Main.notifyError('Failed to open URI!', e.message);
    }
  }

  // Launches the application described by the given Gio.AppInfo object.
  static _launchApp(app) {
    let ctx = global.create_app_launch_context(0, -1);

    try {
      app.launch([], ctx);
    } catch (e) {
      Main.notifyError('Failed to launch app!', e.message);
    }
  }
};
