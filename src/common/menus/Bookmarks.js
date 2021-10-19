//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const {Gio, GLib} = imports.gi;
const ByteArray   = imports.byteArray;

const _ = imports.gettext.domain('flypie').gettext;

const Me           = imports.misc.extensionUtils.getCurrentExtension();
const utils        = Me.imports.src.common.utils;
const ItemRegistry = Me.imports.src.common.ItemRegistry;

//////////////////////////////////////////////////////////////////////////////////////////
// The bookmarks menu contains one entry for the default user directories.              //
// See common/ItemRegistry.js for a description of the action's format.                 //
//////////////////////////////////////////////////////////////////////////////////////////

var menu = {

  // There are two fundamental item types in Fly-Pie: Actions and Menus. Actions have an
  // onSelect() method which is called when the user selects the item, Menus can have
  // child Actions or Menus.
  class: ItemRegistry.ItemClass.MENU,

  // This will be shown in the add-new-item-popover of the settings dialog.
  name: _('Bookmarks'),

  // This is also used in the add-new-item-popover.
  icon: 'flypie-menu-bookmarks-symbolic-#7a3',

  // Translators: Please keep this short.
  // This is the (short) description shown in the add-new-item-popover.
  subtitle: _('Shows your frequently used directories.'),

  // This is the (long) description shown when an item of this type is selected.
  description: _(
      'The <b>Bookmarks</b> menu shows an item for the trash, your desktop and each bookmarked directory.'),

  // This will be called whenever a menu is opened containing an item of this kind.
  createItem: () => {
    // Adds an action for the given (file://) uri to the children list of
    // the given menu item. The name parameter is optional and will be used
    // if given. Else the name of the file defined by the uri is used.
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
          onSelect: () => {
            // Open the file with the default application.
            try {
              const ctx = global.create_app_launch_context(0, -1);
              Gio.AppInfo.launch_default_for_uri(uri, ctx);
            } catch (error) {
              utils.debug('Failed to open "%s": %s'.format(this.name, error));
            }
          }
        });
      }
    };

    // Create the submenu for all the bookmarks.
    const result = {children: []};

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
          // Some lines contain an alias for the bookmark. This alias starts
          // at the first space of the line.
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
};
