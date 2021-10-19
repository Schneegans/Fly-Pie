//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Gio = imports.gi.Gio;

const _ = imports.gettext.domain('flypie').gettext;

const Me           = imports.misc.extensionUtils.getCurrentExtension();
const utils        = Me.imports.src.common.utils;
const ItemRegistry = Me.imports.src.common.ItemRegistry;

//////////////////////////////////////////////////////////////////////////////////////////
// The devices menu contains an item for each mounted volume as reported by the         //
// Gio.VolumeMonitor.                                                                   //
// See common/ItemRegistry.js for a description of the action's format.                 //
//////////////////////////////////////////////////////////////////////////////////////////

var menu = {

  // There are two fundamental item types in Fly-Pie: Actions and Menus. Actions have an
  // onSelect() method which is called when the user selects the item, Menus can have
  // child Actions or Menus.
  class: ItemRegistry.ItemClass.MENU,

  // This will be shown in the add-new-item-popover of the settings dialog.
  name: _('Devices'),

  // This is also used in the add-new-item-popover.
  icon: 'flypie-menu-devices-symbolic-#979',

  // Translators: Please keep this short.
  // This is the (short) description shown in the add-new-item-popover.
  subtitle: _('Shows connected devices.'),

  // This is the (long) description shown when an item of this type is selected.
  description: _(
      'The <b>Devices</b> menu shows an item for each mounted volume, like USB sticks.'),

  // This will be called whenever a menu is opened containing an item of this kind.
  createItem: () => {
    const result  = {children: []};
    const monitor = Gio.VolumeMonitor.get();

    // Add a child item for each mounted volume.
    monitor.get_mounts().forEach(mount => {
      result.children.push({
        name: mount.get_name(),
        icon: mount.get_icon().to_string(),
        onSelect: () => {
          try {
            const ctx = global.create_app_launch_context(0, -1);
            Gio.AppInfo.launch_default_for_uri(mount.get_root().get_uri(), ctx);
          } catch (error) {
            utils.debug('Failed to open "%s": %s'.format(mount.get_name(), error));
          }
        }
      });
    });

    return result;
  }
};
