//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const {Gtk, GLib} = imports.gi;

const _ = imports.gettext.domain('flypie').gettext;

const Me                  = imports.misc.extensionUtils.getCurrentExtension();
const utils               = Me.imports.src.common.utils;
const ItemRegistry        = Me.imports.src.common.ItemRegistry;
const ConfigWidgetFactory = Me.imports.src.common.ConfigWidgetFactory.ConfigWidgetFactory;

// We have to import the Shell module optionally. This is because this file is included
// from both sides: From prefs.js and from extension.js. When included from prefs.js, this
// module is not available. This is not a problem, as the preferences will not call the
// createItem() methods below; they are merely interested in the menu's name, icon and
// description.
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
  // onSelect() method which is called when the user selects the item, Menus can have
  // child Actions or Menus.
  class: ItemRegistry.ItemClass.MENU,

  // This will be shown in the add-new-item-popover of the settings dialog.
  name: _('Running Apps'),

  // This is also used in the add-new-item-popover.
  icon: 'flypie-menu-running-apps-symbolic-#74a',

  // Translators: Please keep this short.
  // This is the (short) description shown in the add-new-item-popover.
  subtitle: _('Shows the currently running applications.'),

  // This is the (long) description shown when an item of this type is selected.
  description: _(
      'The <b>Running Apps</b> menu shows all currently running applications. This is similar to the Alt+Tab window selection. As the entries change position frequently, this is actually not very effective.'),

  // Items of this type have several additional configuration parameter.
  config: {
    // This is used as data for newly created items of this type.
    defaultData: {
      activeWorkspaceOnly: false,
      appGrouping: true,
      hoverPeeking: true,
      nameRegex: ''
    },

    // This is called whenever an item of this type is selected in the menu editor. It
    // returns a Gtk.Widget which will be shown in the sidebar of the menu editor. The
    // currently configured data object will be passed as first parameter. The second
    // parameter is a callback which must be fired whenever the user changes something in
    // the widgets.
    getWidget(data, updateCallback) {
      // Use default data for undefined properties.
      data = {...this.defaultData, ...data};

      const vBox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 5});

      let toggles   = [];
      let nameRegex = data.nameRegex;

      // This is called whenever one of the toggles is switched or when the user enters
      // something in the name filter entry.
      const _updateData = () => {
        updateCallback({
          activeWorkspaceOnly: toggles[0].active,
          appGrouping: toggles[1].active,
          hoverPeeking: toggles[2].active,
          nameRegex: nameRegex
        });
      };

      // First create the name filter entry.
      const tooltip = _(
          'You can use this to filter the displayed windows. Regular expressions are supported: Use a simple string like "Fire" to show only windows whose titles contain "Fire" (e.g. Firefox). Use "Fire|Water" to match either "Fire" or "Water". A negation would be "^(?!.*Fire)" to match anything but "Fire". Remember to use the live preview to instantly see the results!');
      const regexEntry = ConfigWidgetFactory.createTextWidget(
          _('Window Filter'), _('See tooltip for details.'), tooltip, data.nameRegex,
          text => {
            nameRegex = text;
            _updateData();
          });
      utils.boxAppend(vBox, regexEntry);

      // Then create the three switches.
      const _createToggle = (i, name, value) => {
        const hBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 5});
        utils.boxAppend(
            hBox, new Gtk.Label({label: name, halign: Gtk.Align.START, hexpand: true}),
            false, true);

        const toggle = new Gtk.Switch({active: value, halign: Gtk.Align.END});
        utils.boxAppend(hBox, toggle);

        toggle.connect('notify::active', () => {
          _updateData();
        });

        utils.boxAppend(vBox, hBox);

        return toggle;
      };

      toggles[0] = _createToggle(0, _('Active Workspace Only'), data.activeWorkspaceOnly);
      toggles[1] = _createToggle(1, _('Group by Application'), data.appGrouping);
      toggles[2] = _createToggle(2, _('Peek on Hover'), data.hoverPeeking);

      return vBox;
    }
  },

  // This will be called whenever a menu is opened containing an item of this kind.
  createItem: (data) => {
    // Use default data for undefined properties.
    data = {...menu.config.defaultData, ...data};

    // Retrieve a list of all running apps and sort it alphabetically to make the window
    // positions more deterministic.
    const apps = Shell.AppSystem.get_default().get_running();
    apps.sort((a, b) => a.get_name().localeCompare(b.get_name()));

    // This will be our menu.
    const result = {children: []};

    // Now iterate through all windows of all apps.
    apps.forEach(app => {
      let windows = app.get_windows();

      // Filter windows which do not match the regex.
      windows = windows.filter(w => (new RegExp(data.nameRegex)).test(w.title));

      // Filter windows which are not on the current workspace.
      if (data.activeWorkspaceOnly) {
        windows = windows.filter(
            w => w.get_workspace() == global.workspace_manager.get_active_workspace());
      }

      // Sort the remaining windows alphabetically.
      windows.sort((a, b) => a.title.localeCompare(b.title));

      // Get the icon for our items.
      let icon = 'image-missing';
      try {
        icon = app.get_app_info().get_icon().to_string();
      } catch (e) {
      }

      // We will add the window items directly to the result menu. Only if there are more
      // than one window for the current app and grouping is enabled, we will create a
      // submenu.
      let parentMenu = result;
      if (data.appGrouping && windows.length > 1) {
        parentMenu = {name: app.get_name(), icon: icon, children: []};
        result.children.push(parentMenu);
      }

      // Now add the actual items!
      windows.forEach(window => {
        parentMenu.children.push({
          name: window.get_title(),
          icon: icon,

          // If selected, we switch to the corresponding window. If window peeking is
          // enabled, this is not required as the hover event was fired already.
          onSelect: () => {
            if (!data.hoverPeeking) {
              window.get_workspace().activate_with_focus(
                  window, global.display.get_current_time_roundtrip());
            }
          },

          // If hovered, we switch to the corresponding window if window peeking is
          // enabled.
          onHover: () => {
            if (data.hoverPeeking) {
              window.get_workspace().activate_with_focus(
                  window, global.display.get_current_time_roundtrip());
            }
          }
        });
      });
    });

    return result;
  }
};