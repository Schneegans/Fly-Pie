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
import GLib from 'gi://GLib';
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

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const _ = imports.gettext.domain('flypie').gettext;

export default class FlyPiePreferences extends ExtensionPreferences {

  fillPreferencesWindow(window) {

    // Give some space to the window's widgets.
    window.set_default_size(650, 750);

    // Create the Gio.Settings object.
    this._settings = utils.createSettings();

    // This we need to check whether ui animations are enabled.
    this._shellSettings = Gio.Settings.new('org.gnome.desktop.interface');

    // Load all of Fly-Pie's resources.
    this._resources = Gio.Resource.load(this.path + '/resources/flypie.gresource');
    Gio.resources_register(this._resources);

    // Register some custom Gtk widgets. This needs to be done before creating the builder
    // below as this will instantiate some of these custom widgets.
    MenuEditor.registerWidgets();
    IconSelectDialog.registerWidget();
    ImageChooserButton.registerWidget();
    CopyValueButton.registerWidget();

    // Load the user interface file.
    this._builder = new Gtk.Builder();
    this._builder.add_from_resource(`/ui/common/menus.ui`);
    this._builder.add_from_resource(`/ui/gtk4/settings.ui`);

    // Load the CSS file for the settings dialog.
    const styleProvider = Gtk.CssProvider.new();
    styleProvider.load_from_resource('/css/flypie.css');
    Gtk.StyleContext.add_provider_for_display(
        Gdk.Display.get_default(), styleProvider,
        Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);

    // To structure the source code, the code for the individual dialog pages has been put
    // into separate classes.

    // Initialize the Tutorial page.
    this._tutorialPage = new TutorialPage(this._builder, this._settings);

    // Initialize the Settings page.
    this._settingsPage = new SettingsPage(this._builder, this._settings, this.path);

    // Initialize the Menu Editor page.
    this._menuEditorPage = new MenuEditorPage(this._builder, this._settings);

    // Initialize the Achievements page.
    this._achievementsPage = new AchievementsPage(this._builder, this._settings);

    // Hide the in-app notification when its close button is pressed.
    this._builder.get_object('notification-close-button').connect('clicked', () => {
      this._builder.get_object('notification-revealer').reveal_child = false;
    });

    // This is our top-level widget which we will return later.
    this._widget = this._builder.get_object('main-notebook');

    // Because it looks cool, we add the stack switcher and the menu button to the
    // window's title bar. We also make the bottom corners rounded.
    this._widget.connect('realize', widget => {
      const window = widget.get_root();

      const stackSwitcher = this._builder.get_object('main-stack-switcher');
      const menuButton    = this._builder.get_object('menu-button');

      stackSwitcher.parent.remove(menuButton);
      stackSwitcher.parent.remove(stackSwitcher);

      // In the future, we should drop support for older GNOME versions and rewrite the
      // entire dialog using libadwaita widgets!

      // Add widgets to the titlebar.
      const titlebar = this._findChildByType(window, Adw.HeaderBar);
      titlebar.set_title_widget(stackSwitcher);
      titlebar.pack_start(menuButton);

      // "disable" the Adw.Clamp.
      const clamp        = this._findParentByType(widget, Adw.Clamp);
      clamp.maximum_size = 100000;

      // Disable the Gtk.ScrolledWindow.
      const scroll             = this._findParentByType(widget, Gtk.ScrolledWindow);
      scroll.vscrollbar_policy = Gtk.PolicyType.NEVER;

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

          const sponsors     = this._getJSONResource('/credits/sponsors.json');
          const contributors = this._getJSONResource('/credits/contributors.json');
          let dialog;

          // We try to use the special Adw.AboutWindow if it is available.
          if (Adw && Adw.AboutWindow) {
            let formatSponsors = (sponsors) => {
              return sponsors.map(s => {
                if (s.url == '')
                  return s.name;
                else
                  return `${s.name} ${s.url}`;
              });
            };

            dialog = new Adw.AboutWindow({transient_for: window, modal: true});
            dialog.set_application_icon('flypie-symbolic');
            dialog.set_application_name('Fly-Pie');
            dialog.set_version(`${this.metadata.version}`);
            dialog.set_developer_name('Simon Schneegans');
            dialog.set_developers(contributors.code);
            dialog.set_designers(contributors.artwork);
            dialog.set_issue_url('https://github.com/Schneegans/Fly-Pie/issues');
            if (sponsors.gold.length > 0) {
              dialog.add_credit_section(
                  _('Gold Sponsors'), formatSponsors(sponsors.gold));
            }
            if (sponsors.silver.length > 0) {
              dialog.add_credit_section(
                  _('Silver Sponsors'), formatSponsors(sponsors.silver));
            }
            if (sponsors.bronze.length > 0) {
              dialog.add_credit_section(
                  _('Bronze Sponsors'), formatSponsors(sponsors.bronze));
            }
            if (sponsors.past.length > 0) {
              dialog.add_credit_section(
                  _('Past Sponsors'), formatSponsors(sponsors.past));
            }

          } else {

            let formatSponsors = (sponsors) => {
              return sponsors.map(s => {
                if (s.url == '')
                  return s.name;
                else
                  return `<a href="${s.url}">${s.name}</a>`;
              });
            };

            dialog = new Gtk.AboutDialog({transient_for: window, modal: true});
            dialog.set_logo_icon_name('flypie-symbolic');
            dialog.set_program_name(`Fly-Pie ${this.metadata.version}`);
            dialog.set_authors(contributors.code);
            dialog.set_artists(contributors.artwork);
            if (sponsors.gold.length > 0) {
              dialog.add_credit_section(
                  _('Gold Sponsors'), formatSponsors(sponsors.gold));
            }
            if (sponsors.silver.length > 0) {
              dialog.add_credit_section(
                  _('Silver Sponsors'), formatSponsors(sponsors.silver));
            }
            if (sponsors.bronze.length > 0) {
              dialog.add_credit_section(
                  _('Bronze Sponsors'), formatSponsors(sponsors.bronze));
            }
            if (sponsors.past.length > 0) {
              dialog.add_credit_section(
                  _('Past Sponsors'), formatSponsors(sponsors.past));
            }
          }

          dialog.set_translator_credits([...translators].join('\n'));
          dialog.set_copyright('© 2022 Simon Schneegans');
          dialog.set_website('https://github.com/Schneegans/Fly-Pie');
          dialog.set_license_type(Gtk.License.MIT_X11);

          dialog.show();
        });

        group.add_action(aboutAction);
      }
    });

    // Save the currently active settings page. This way, the tutorial will be shown when
    // the settings dialog is shown for the first time. Then, when the user modified
    // something on another page, this will be shown when the settings dialog is shown
    // again.
    const stack              = this._builder.get_object('main-stack');
    stack.visible_child_name = this._settings.get_string('active-stack-child');
    stack.connect('notify::visible-child-name', (stack) => {
      this._settings.set_string('active-stack-child', stack.visible_child_name);
    });

    // As we do not have something like a destructor, we just listen for the destroy
    // signal of our main widget.
    this._widget.connect('destroy', () => {
      if (this._showAnimationInfoTimeout > 0) {
        GLib.source_remove(this._showAnimationInfoTimeout);
      }

      // Delete the static settings object of the statistics.
      Statistics.destroyInstance();

      // Disconnect some settings handlers of the individual pages.
      this._tutorialPage.destroy();
      this._settingsPage.destroy();
      this._achievementsPage.destroy();

      // Unregister our resources.
      Gio.resources_unregister(this._resources);
    });

    // Record this construction for the statistics.
    Statistics.getInstance().addSettingsOpened();

    window.add(this._widget);
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

  // This traverses the widget tree upwards above the given child and returns the first
  // widget of the given type.
  _findParentByType(child, type) {
    const parent = child.get_parent();

    if (!parent) return null;

    if (parent instanceof type) return parent;

    return this._findParentByType(parent, type);
  }
}
