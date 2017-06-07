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

const Me = ExtensionUtils.getCurrentExtension();

const debug = Me.imports.debug.debug;

/////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////

const RecentGroup = new Lang.Class({
  Name : 'RecentGroup',

  // ----------------------------------------------------------- constructor / destructor

  _init : function () {
    this._recentManager = Gtk.RecentManager.get_default();
  },

  // ------------------------------------------------------------------- public interface

  getItems : function () {
    let recentFiles = this._recentManager.get_items();
    let result = new Array();

    for (let id = 0; id < recentFiles.length; id++) {
      let recentInfo = recentFiles[id];
      if (recentInfo.exists()) {
        result.push({
            name:     recentInfo.get_display_name(),
            icon:     recentInfo.get_gicon().to_string(),
            activate: Lang.bind(this, function() {
              this._launchItem(recentInfo.get_uri());
            })
        });
      }
    }

    return result;
  },

  // ---------------------------------------------------------------------- private stuff

  _launchItem : function(uri) {
    let ctx = global.create_app_launch_context(0, -1);
    // ctx.set_timestamp(global.get_current_time());

    try {
      Gio.AppInfo.launch_default_for_uri(uri, ctx);
    } catch(e) {
      Main.notifyError("Failed to open menu item!", e.message);
    }
  }
});
