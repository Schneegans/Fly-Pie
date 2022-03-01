//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const _ = imports.gettext.domain('flypie').gettext;

const Me           = imports.misc.extensionUtils.getCurrentExtension();
const ItemRegistry = Me.imports.src.common.ItemRegistry;

// We have to import the Shell and SystemActions modules optionally. This is because this
// file is included from both sides: From prefs.js and from extension.js. When included
// from prefs.js, the Shell and SystemActions modules are not available. This is not a
// problem, as the preferences will not call the createItem() methods below; they are
// merely interested in the menu's name, icon and description.
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
// https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/main/js/ui/status/system.js.       //
// See common/ItemRegistry.js for a description of the action's format.                 //
//////////////////////////////////////////////////////////////////////////////////////////

var menu = {

  // There are two fundamental item types in Fly-Pie: Actions and Menus. Actions have an
  // onSelect() method which is called when the user selects the item, Menus can have
  // child Actions or Menus.
  class: ItemRegistry.ItemClass.MENU,

  // This will be shown in the add-new-item-popover of the settings dialog.
  name: _('System'),

  // This is also used in the add-new-item-popover.
  icon: 'flypie-menu-system-symbolic-#69b',

  // Translators: Please keep this short.
  // This is the (short) description shown in the add-new-item-popover.
  subtitle: _('Allows screen lock, shutdown and other things.'),

  // This is the (long) description shown when an item of this type is selected.
  description: _(
      'The <b>System</b> menu shows an items for screen-lock, shutdown, settings, etc.'),

  // This will be called whenever a menu is opened containing an item of this kind.
  createItem: () => {
    const result = {children: []};

    // Make sure all can_* booleans we check below are up-to-date.
    SystemActions.forceUpdate();

    // Add item for the gnome control center.
    let app = Shell.AppSystem.get_default().lookup_app('gnome-control-center.desktop');

    if (app) {
      result.children.push({
        name: app.get_name(),
        icon: 'flypie-menu-system-settings-symbolic-#69b',
        onSelect: () => app.activate()
      });
    }

    // Add screen-lock item.
    if (SystemActions.can_lock_screen) {
      result.children.push({
        // Translators: As in 'Lock the screen.'
        name: _('Lock'),
        icon: 'flypie-menu-system-lock-symbolic-#69b',
        onSelect: () => SystemActions.activateLockScreen()
      });
    }

    // Add suspend-item.
    if (SystemActions.can_suspend) {
      result.children.push({
        name: _('Suspend'),
        icon: 'flypie-menu-system-suspend-symbolic-#69b',
        onSelect: () => SystemActions.activateSuspend()
      });
    }

    // Add switch user item.
    if (SystemActions.can_switch_user) {
      result.children.push({
        name: _('Switch User…'),
        icon: 'flypie-menu-system-switchuser-symbolic-#69b',
        onSelect: () => SystemActions.activateSwitchUser()
      });
    }

    // Add log-out item.
    if (SystemActions.can_logout) {
      result.children.push({
        name: _('Log Out'),
        icon: 'flypie-menu-system-logout-symbolic-#69b',
        onSelect: () => SystemActions.activateLogout()
      });
    }

    // Add power-off item.
    if (SystemActions.can_power_off) {
      result.children.push({
        name: _('Power Off…'),
        icon: 'flypie-menu-system-poweroff-symbolic-#69b',
        onSelect: () => SystemActions.activatePowerOff()
      });
    }

    return result;
  }
};
