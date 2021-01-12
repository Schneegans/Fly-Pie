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

// We have to import the Shell module optionally. This is because this file is included
// from both sides: From prefs.js and from extension.js. When included from prefs.js, the
// Shell module is not available. This is not a problem, as the preferences will not call
// the createItem() methods below; they are merely interested in the menu's name, icon
// and description.
let Shell = undefined;

try {
  Shell = imports.gi.Shell;
} catch (error) {
  // Nothing to be done, we're in settings-mode.
}

//////////////////////////////////////////////////////////////////////////////////////////
// Returns an item with entries for all running applications. Clicking these will bring //
// the corresponding app to the foreground. Like Alt-Tab.                               //
// See common/ItemRegistry.js for a description of the action's format.                 //
//////////////////////////////////////////////////////////////////////////////////////////

var menu = {

  // There are two fundamental item types in Fly-Pie: Actions and Menus. Actions have an
  // activate() method which is called when the user selects the item, Menus can have
  // child Actions or Menus.
  class: ItemRegistry.ItemClass.MENU,

  // This will be shown in the add-new-item-popover of the settings dialog.
  name: _('Running Apps'),

  // This is also used in the add-new-item-popover.
  icon: 'preferences-system-windows',

  // Translators: Please keep this short.
  // This is the (short) description shown in the add-new-item-popover.
  subtitle: _('Shows the currently running applications.'),

  // This is the (long) description shown when an item of this type is selected.
  description: _(
      'The <b>Running Apps</b> menu shows all currently running applications. This is similar to the Alt+Tab window selection. As the entries change position frequently, this is actually not very effective.'),

  // This will be called whenever a menu is opened containing an item of this kind.
  createItem: () => {
    const apps   = Shell.AppSystem.get_default().get_running();
    const result = {children: []};

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
};