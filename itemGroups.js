/////////////////////////////////////////////////////////////////////////////////////////
//                                                                                     //
//    _____                    ___  _     ___       This software may be modified      //
//   / ___/__  ___  __ _  ___ / _ \(_)__ |_  |      and distributed under the          //
//  / (_ / _ \/ _ \/  ' \/ -_) ___/ / -_) __/       terms of the MIT license. See      //
//  \___/_//_/\___/_/_/_/\__/_/  /_/\__/____/       the LICENSE file for details.      //
//                                                                                     //
//  Authors: Simon Schneegans (code@simonschneegans.de)                                //
//                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////

const Lang           = imports.lang;
const Gtk            = imports.gi.Gtk;
const ExtensionUtils = imports.misc.extensionUtils;
const Main           = imports.ui.main;
const Gio            = imports.gi.Gio;
const Shell          = imports.gi.Shell;
const GLib           = imports.gi.GLib;
const GMenu          = imports.gi.GMenu; 

const Me = ExtensionUtils.getCurrentExtension();

const debug = Me.imports.debug.debug;

/////////////////////////////////////////////////////////////////////////////////////////
// Parts of this code is based on the Gno-Menu extension by Panacier                   //
// (https://github.com/The-Panacea-Projects/Gnomenu)                                   //
/////////////////////////////////////////////////////////////////////////////////////////

// const PlaceType = Object.freeze({RED: 0, GREEN: 1, BLUE: 2});

const FileInfo = new Lang.Class({
  Name: 'FileInfo',

  _init: function(file) {
    this._file = file;
  },

  openDefault: function() {
    let launchContext = global.create_app_launch_context(0, -1);
    // launchContext.set_timestamp(timestamp);

    try {
      Gio.AppInfo.launch_default_for_uri(this._file.get_uri(), launchContext);
    } catch(e if e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_MOUNTED)) {
      this._file.mount_enclosing_volume(0, null, null, function(file, result) {
        file.mount_enclosing_volume_finish(result);
        Gio.AppInfo.launch_default_for_uri(file.get_uri(), launchContext);
      });
    } catch(e) {
      Main.notifyError("Failed to open \"%s\"".format(this.name), e.message);
    }
  },

  getIcon: function() {
    try {
      let info = this._file.query_info("standard::icon", 0, null);
      return info.get_icon().to_string();
    } catch(e) {
      return 'firefox';
    }
  },

  getName: function() {
    try {
      let info = this._file.query_info('standard::display-name', 0, null);
      return info.get_display_name();
    } catch(e) {
      return this._file.get_basename();
    }
  }
});

/////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////

const RecentGroup = new Lang.Class({
  Name : 'RecentGroup',

  // ----------------------------------------------------------- constructor / destructor

  _init : function () {
    this._recentManager = Gtk.RecentManager.get_default();
  },

  // ------------------------------------------------------------------- public interface

  getUserDirectoriesItems : function () {
    let recentFiles = this._recentManager.get_items();
    let result = {name:"Places", icon:"nautilus", items:[]};

    this._pushFileInfo(result, new FileInfo(Gio.File.new_for_path(GLib.get_home_dir())));

    const DEFAULT_DIRECTORIES = [
      GLib.UserDirectory.DIRECTORY_DESKTOP,
      GLib.UserDirectory.DIRECTORY_DOCUMENTS,
      GLib.UserDirectory.DIRECTORY_DOWNLOAD,
      GLib.UserDirectory.DIRECTORY_MUSIC,
      GLib.UserDirectory.DIRECTORY_PICTURES,
      GLib.UserDirectory.DIRECTORY_TEMPLATES,
      GLib.UserDirectory.DIRECTORY_PUBLIC_SHARE,
      GLib.UserDirectory.DIRECTORY_VIDEOS
    ];

    for (let i=0; i<DEFAULT_DIRECTORIES.length; ++i) {
      let path = GLib.get_user_special_dir(DEFAULT_DIRECTORIES[i]);
      this._pushFileInfo(result, new FileInfo(Gio.File.new_for_path(path)));
    }

    return result;
  },

  getRecentItems : function () {
    let recentFiles = this._recentManager.get_items();
    let result = {items:[]};

    for (let i=0; i<recentFiles.length; ++i) {
      this._pushRecentInfo(result, recentFiles[i]);
    }

    return result;
  },

  getFavoriteItems : function () {
    let apps = global.settings.get_strv('favorite-apps');
    let result = {items:[]};

    for (let i=0; i<apps.length; ++i) {
      let app = Shell.AppSystem.get_default().lookup_app(apps[i]);
      this._pushShellApp(result, app);
    }

    return result;
  },

  getFrequentItems : function () {
    let apps = Shell.AppUsage.get_default().get_most_used('');
    let result = {items:[]};

    for (let i=0; i<apps.length; ++i) {
      this._pushShellApp(result, apps[i]);
    }

    return result;
  },

  getRunningAppsItems : function () {
    let apps = Shell.AppSystem.get_default().get_running();
    let result = {items:[]};

    for (let i=0; i<apps.length; ++i) {
      let windows = apps[i].get_windows();
      let icon = apps[i].get_app_info().get_icon().to_string();
      for (let j=0; j<windows.length; ++j) {
        this._pushWindow(result, windows[j], icon);
      }
    }

    return result;
  },

  getAppMenuItems : function () {
    let menu = new GMenu.Tree({
      menu_basename: 'applications.menu',
      flags: GMenu.TreeFlags.NONE
    });

    menu.load_sync();

    let result = {items:[]};

    this._pushMenuItems(result, menu.get_root_directory());

    return result;
  },

  // ---------------------------------------------------------------------- private stuff

  _pushMenuItems : function(menu, dir) {

    let iter = dir.iter(), nodeType, item;

    while ((nodeType = iter.next()) !== GMenu.TreeItemType.INVALID) {
      switch (nodeType) {
        case GMenu.TreeItemType.ENTRY:
          let app = iter.get_entry().get_app_info();
          item = {
            name:     app.get_name(),
            icon:     app.get_icon().to_string(),
            activate: Lang.bind(this, function() {
              this._launchApp(app);
            })
          };
          menu.items.push(item);
          break;
        case GMenu.TreeItemType.DIRECTORY:
          let directory = iter.get_directory();
          item = {
            name: directory.get_name(),
            icon: directory.get_icon().to_string(),
            items: []
          };

          this._pushMenuItems(item, directory);
          
          menu.items.push(item);

          break;
        default: // SEPARATOR, HEADER, ALIAS. skip for now.
          break;
      }
    }
  },

  _pushShellApp : function(menu, app) {
    if (app && app.get_app_info().should_show()) {
      menu.items.push({
        name:     app.get_name(),
        icon:     app.get_app_info().get_icon().to_string(),
        activate: Lang.bind(this, function() {
          app.open_new_window(-1);
        })
      });
    }
  },

  _pushWindow : function(menu, win, icon) {
    if (win) {
      menu.items.push({
        name:     win.get_title(),
        icon:     icon,
        activate: Lang.bind(this, function() {
          win.activate(0 /*timestamp*/);
        })
      });
    }
  },

  _pushRecentInfo : function(menu, info) {
    if (info.exists()) {
      menu.items.push({
        name:     info.get_display_name(),
        icon:     info.get_gicon().to_string(),
        activate: Lang.bind(this, function() {
          this._openUri(info.get_uri());
        })
      });
    }
  },

  _pushFileInfo : function(menu, file) {
    menu.items.push({
      name:     file.getName(),
      icon:     file.getIcon(),
      activate: Lang.bind(this, function() {
        file.openDefault();
      })
    });
  },

  _openUri : function(uri) {
    let ctx = global.create_app_launch_context(0, -1);
    // ctx.set_timestamp(global.get_current_time());

    try {
      Gio.AppInfo.launch_default_for_uri(uri, ctx);
    } catch(e) {
      Main.notifyError("Failed to open URI!", e.message);
    }
  },

  _launchApp : function(app) {
    let ctx = global.create_app_launch_context(0, -1);
    // ctx.set_timestamp(global.get_current_time());

    try {
      app.launch([], ctx);
    } catch(e) {
      Main.notifyError("Failed to launch app!", e.message);
    }
  }
});
