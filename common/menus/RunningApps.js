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

// We import Shell optionally. When this file is included from the daemon side, it is
// available and can be used in the activation code of the action defined below. If this
// file is included via the pref.js, it will not be available. But this is not a problem,
// as the preferences will not call the createItem() methods below; they are merely
// interested in the action's name, icon and description.
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
  name: _('Running Apps'),
  icon: 'preferences-system-windows',
  // Translators: Please keep this short.
  subtitle: _('Shows the currently running applications.'),
  description: _(
      'The <b>Running Apps</b> menu shows all currently running applications. This is similar to the Alt+Tab window selection. As the entries change position frequently, this is actually not very effective.'),
  itemClass: Enums.ItemClass.MENU,
  dataType: Enums.ItemDataType.NONE,
  defaultData: '',
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