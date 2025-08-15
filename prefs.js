//////////////////////////////////////////////////////////////////////////////////////////
//                               ___            _     ___                               //
//                               |   |   \/    | ) |  |                                 //
//                           O-  |-  |   |  -  |   |  |-  -O                            //
//                               |   |_  |     |   |  |_                                //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

// SPDX-FileCopyrightText: Simon Schneegans <code@simonschneegans.de>
// SPDX-License-Identifier: MIT

'use strict';

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';

import * as utils from './src/common/utils.js';
import Statistics from './src/common/Statistics.js';
import TutorialPage from './src/prefs/TutorialPage.js';
import SettingsPage from './src/prefs/SettingsPage.js';
import MenuEditorPage from './src/prefs/MenuEditorPage.js';
import {AchievementsPage} from './src/prefs/AchievementsPage.js';
import * as MenuEditor from './src/prefs/MenuEditor.js';
import * as IconSelectDialog from './src/prefs/IconSelectDialog.js';
import * as CopyValueButton from './src/prefs/CopyValueButton.js';
import * as ImageChooserButton from './src/prefs/ImageChooserButton.js';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class FlyPiePreferences extends ExtensionPreferences {

  fillPreferencesWindow(window) {

    // Give some space to the window's widgets.
    window.set_default_size(850, 800);
    window.set_size_request(850, 550);

    // Create the Gio.Settings object.
    const settings = utils.createSettings();

    // Load all of Fly-Pie's resources.
    const resources = Gio.Resource.load(this.path + '/resources/flypie.gresource');
    Gio.resources_register(resources);

    // Make sure custom icons are found.
    Gtk.IconTheme.get_for_display(Gdk.Display.get_default()).add_resource_path('/img');

    // Register some custom Gtk widgets. This needs to be done before creating the builder
    // below as this will instantiate some of these custom widgets.
    MenuEditor.registerWidgets();
    IconSelectDialog.registerWidget();
    ImageChooserButton.registerWidget();
    CopyValueButton.registerWidget();

    // Load the user interface file.
    const builder = new Gtk.Builder();
    builder.add_from_resource(`/ui/common/menus.ui`);
    builder.add_from_resource(`/ui/gtk4/settings.ui`);

    // Load the CSS file for the settings dialog.
    const styleProvider = Gtk.CssProvider.new();
    styleProvider.load_from_resource('/css/flypie.css');
    Gtk.StyleContext.add_provider_for_display(
        Gdk.Display.get_default(), styleProvider,
        Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);

    // To structure the source code, the code for the individual dialog pages has been put
    // into separate classes.

    // Initialize the Tutorial page.
    const tutorialPage = new TutorialPage(builder, settings);

    // Initialize the Settings page.
    const settingsPage = new SettingsPage(builder, settings, this.path);

    // Initialize the Menu Editor page.
    const menuEditorPage = new MenuEditorPage(builder, settings);

    // Initialize the Achievements page.
    const achievementsPage = new AchievementsPage(builder, settings);

    // These are our top-level preferences pages which we will return later.
    this._pages = [
      builder.get_object('tutorial-page'), builder.get_object('settings-page'),
      builder.get_object('menu-editor-page'), builder.get_object('achievements-page')
    ];

    // Because it looks cool, we add the stack switcher and the menu button to the
    // window's title bar. We should refactor this to use libadwaita widgets in the
    // future.
    this._pages[0].connect('realize', widget => {
      const window = widget.get_root();

      // Save the currently active settings page. This way, the tutorial will be shown
      // when the settings dialog is shown for the first time. Then, when the user
      // modified something on another page, this will be shown when the settings dialog
      // is shown again.
      window.visible_page_name = settings.get_string('active-stack-child');
      window.connect('notify::visible-page-name', (w) => {
        settings.set_string('active-stack-child', w.visible_page_name);
      });

      // Add the menu to the header bar.
      const menu   = builder.get_object('menu-button');
      const header = this._findChildByType(window.get_content(), Adw.HeaderBar);
      header.pack_start(menu);

      // Now create all the actions for the main menu.
      const group = Gio.SimpleActionGroup.new();
      window.insert_action_group('prefs', group);

      // Add the main menu to the title bar.
      {
        const addURIAction = (name, uri) => {
          const action = Gio.SimpleAction.new(name, null);
          action.connect('activate', () => Gtk.show_uri(null, uri, Gdk.CURRENT_TIME));
          group.add_action(action);
        };

        // There is a hidden achievement for viewing the sponsors page...
        const addSponsorAction = (name, uri) => {
          const action = Gio.SimpleAction.new(name, null);
          action.connect('activate', () => {
            Gtk.show_uri(null, uri, Gdk.CURRENT_TIME);
            Statistics.getInstance().addSponsorsViewed();
          });
          group.add_action(action);
        };

        // clang-format off
        addURIAction('homepage',  'https://github.com/Schneegans/Fly-Pie');
        addURIAction('bugs',      'https://github.com/Schneegans/Fly-Pie/issues');
        addURIAction('changelog', 'https://github.com/Schneegans/Fly-Pie/blob/main/docs/changelog.md');
        addURIAction('translate', 'https://hosted.weblate.org/engage/Fly-Pie/');
        addSponsorAction('show-sponsors', 'https://schneegans.github.io/sponsors');
        addSponsorAction('donate-kofi',   'https://ko-fi.com/schneegans');
        addSponsorAction('donate-github', 'https://github.com/sponsors/Schneegans');
        addSponsorAction('donate-paypal', 'https://www.paypal.me/simonschneegans');
        // clang-format on

        // Add the about dialog.
        const aboutAction = Gio.SimpleAction.new('about', null);
        aboutAction.connect('activate', () => {
          // The JSON report format from weblate is a bit weird. Here we extract all
          // unique names from the translation report.
          const translators = new Set();
          this._getJSONResource('/credits/translators.json').forEach(i => {
            for (const j of Object.values(i)) {
              j.forEach(k => translators.add(k[1]));
            }
          });

          const contributors = this._getJSONResource('/credits/contributors.json');

          const dialog = new Adw.AboutWindow({transient_for: window, modal: true});
          dialog.set_application_icon('flypie-symbolic');
          dialog.set_application_name('Fly-Pie');
          dialog.set_version(`${this.metadata.version}`);
          dialog.set_developer_name('Simon Schneegans');
          dialog.set_developers(contributors.code);
          dialog.set_designers(contributors.artwork);
          dialog.set_issue_url('https://github.com/Schneegans/Fly-Pie/issues');
          dialog.set_translator_credits([...translators].join('\n'));
          dialog.set_copyright('© 2022 Simon Schneegans');
          dialog.set_website('https://github.com/Schneegans/Fly-Pie');
          dialog.set_license_type(Gtk.License.MIT_X11);

          dialog.show();
        });

        group.add_action(aboutAction);

        // We show an dialog telling the user that Fly-Pie is somewhat deprecated and that
        // they should consider using Kando instead.
        window.connect('notify::visible', (window) => {
          // Do not show the dialog when the window is hidden.
          if (!window.get_visible()) {
            return;
          }

          // Do not show the dialog when the user has disabled it.
          if (!settings.get_boolean('show-kando-dialog')) {
            return;
          }

          const dialog = this._createMessageDialog(
              'It is time to move on!',
              `I am not actively maintaining Fly-Pie anymore. However, I've been working on a cross-platform successor called Kando! It has a lot in common with Fly-Pie, but offers some unique features at the same time. And it's not limited to GNOME!

<b>Learn more: <a href='https://kando.menu'>https://kando.menu</a></b>`,
              window, [
                {
                  label: 'Do not show this again!',
                  destructive: true,
                  default: false,
                  action: () => {
                    settings.set_boolean('show-kando-dialog', false);
                  }
                },
                {
                  label: 'Remind me later.',
                  destructive: false,
                  default: true,
                }
              ]);

          dialog.show();
        });
      }
    });



    // As we do not have something like a destructor, we just listen for the destroy
    // signal of our main widget.
    this._pages[0].connect('destroy', () => {
      // Delete the static settings object of the statistics.
      Statistics.destroyInstance();

      // Disconnect some settings handlers of the individual pages.
      tutorialPage.destroy();
      settingsPage.destroy();
      achievementsPage.destroy();

      // Unregister our resources.
      Gio.resources_unregister(resources);
    });

    // Record this construction for the statistics.
    Statistics.getInstance().addSettingsOpened();

    this._pages.forEach(page => {
      window.add(page);

      // Starting with GNOME 48 there is an additional scrolled window in the adw
      // preference pages which we do not want. We simply hide it.
      if (utils.shellVersionIsAtLeast(48, 'alpha')) {
        const scrolledWindow = this._findChildByType(page, Gtk.ScrolledWindow);
        if (scrolledWindow) {
          scrolledWindow.visible = false;
        }
      }
    });
  }

  // ----------------------------------------------------------------------- private stuff

  // Reads the contents of a JSON file contained in the global resources archive. The data
  // is parsed and returned as a JavaScript object / array.
  _getJSONResource(path) {
    const data   = Gio.resources_lookup_data(path, 0);
    const string = new TextDecoder().decode(data.get_data());
    return JSON.parse(string);
  }

  // This traverses the widget tree downwards below the given parent recursively and
  // returns the first widget of the given type.
  _findChildByType(parent, type) {
    for (const child of [...parent]) {
      if (child instanceof type) return child;

      const match = this._findChildByType(child, type);
      if (match) return match;
    }

    return null;
  }

  // Helper function to show a message dialog. The dialog is modal and has a title, a
  // message and a list of buttons. Each button is an object with a label, a default flag
  // and a destructive flag. Each button object can also have an "action" callback that is
  // called when the button is clicked.
  // This method works on GTK3, GTK4, and libadwaita.
  _createMessageDialog(title, message, window, buttons) {
    let dialog = new Adw.MessageDialog({
      heading: title,
      body: message,
      body_use_markup: true,
      modal: true,
      default_width: 500,
    });

    buttons.forEach((button, i) => {
      const response = i.toString();
      dialog.add_response(response, button.label);

      if (button.default) {
        dialog.set_default_response(response);
        dialog.set_close_response(response);
      }

      if (button.destructive) {
        dialog.set_response_appearance(response, Adw.ResponseAppearance.DESTRUCTIVE);
      }
    });

    dialog.set_hide_on_close(true);
    dialog.set_transient_for(window);

    // If the dialog is closed or a button is clicked, we hide the dialog and call the
    // button's action callback if it exists.
    dialog.connect('response', (dialog, response) => {
      const i = parseInt(response);

      const button = buttons[i];
      if (button && button.action) {
        button.action();
      }

      dialog.hide();
    });

    return dialog;
  }
}
