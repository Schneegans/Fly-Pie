//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const _ = imports.gettext.domain('flypie').gettext;

const Me    = imports.misc.extensionUtils.getCurrentExtension();
const Enums = Me.imports.common.Enums;

// We import Shell and SystemActions optionally. When this file is included from the
// daemon side, they are available and can be used in the activation code of the action
// defined below. If this file is included via the pref.js, they will not be available.
// But this is not a problem, as the preferences will not call the createItem() methods
// below; they are merely interested in the action's name, icon and description.
let Shell         = undefined;
let SystemActions = undefined;

try {
  Shell         = imports.gi.Shell;
  SystemActions = new imports.misc.systemActions.getDefault();
} catch (error) {
  // Nothing to be done, we're in settings-mode.
}

//////////////////////////////////////////////////////////////////////////////////////////
// The System menu shows an items for screen-lock, shutdown, settings, etc. The code    //
// is roughly based on GNOME Shell's tray menu code:                                    //
// https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/master/js/ui/status/system.js.     //
// See common/ItemRegistry.js for a description of the action's format.                 //
//////////////////////////////////////////////////////////////////////////////////////////

var menu = {
  name: _('System'),
  icon: 'system-log-out',
  defaultData: '',
  // Translators: Please keep this short.
  subtitle: _('Allows screen lock shutdown and other things.'),
  description: _(
      'The <b>System</b> menu shows an items for screen-lock, shutdown, settings, etc.'),
  itemClass: Enums.ItemClass.MENU,
  dataType: Enums.ItemDataType.NONE,
  createItem: () => {
    const result = {children: []};

    // Make sure all can_* booleans we check below are up-to-date.
    SystemActions.forceUpdate();

    // Add item for the gnome control center.
    let app = Shell.AppSystem.get_default().lookup_app('gnome-control-center.desktop');

    if (app) {
      result.children.push({
        name: app.get_name(),
        icon: app.get_app_info().get_icon().to_string(),
        activate: () => app.activate()
      });
    }

    // Add screen-lock item.
    if (SystemActions.can_lock_screen) {
      result.children.push({
        name: _('Lock'),
        icon: 'system-lock-screen',
        activate: () => SystemActions.activateLockScreen()
      });
    }

    // Add suspend-item.
    if (SystemActions.can_suspend) {
      result.children.push({
        name: _('Suspend'),
        icon: 'system-suspend',
        activate: () => SystemActions.activateSuspend()
      });
    }

    // Add switch user item.
    if (SystemActions.can_switch_user) {
      result.children.push({
        name: _('Switch User...'),
        icon: 'system-users',
        activate: () => SystemActions.activateSwitchUser()
      });
    }

    // Add log-out item.
    if (SystemActions.can_logout) {
      result.children.push({
        name: _('Log Out'),
        icon: 'system-log-out',
        activate: () => SystemActions.activateLogout()
      });
    }

    // Add power-off item.
    if (SystemActions.can_power_off) {
      result.children.push({
        name: _('Power Off...'),
        icon: 'system-shutdown',
        activate: () => SystemActions.activatePowerOff()
      });
    }

    return result;
  }
};