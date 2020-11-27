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

const Me    = imports.misc.extensionUtils.getCurrentExtension();
const utils = Me.imports.common.utils;
const Enums = Me.imports.common.Enums;

//////////////////////////////////////////////////////////////////////////////////////////
// The devices menu contains an item for each mounted volume as reported by the         //
// Gio.VolumeMonitor.                                                                   //
// See common/ItemRegistry.js for a description of the action's format.                 //
//////////////////////////////////////////////////////////////////////////////////////////

var menu = {
  name: _('Devices'),
  icon: 'drive-harddisk',
  defaultData: '',
  // Translators: Please keep this short.
  subtitle: _('Shows connected devices.'),
  description: _(
      'The <b>Devices</b> menu shows an item for each mounted volume, like USB-Sticks.'),
  itemClass: Enums.ItemClass.MENU,
  dataType: Enums.ItemDataType.NONE,
  createItem: () => {
    const result  = {children: []};
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
            utils.debug('Failed to open "%s": %s'.format(mount.get_name(), error));
          }
        }
      });
    });

    return result;
  }
};