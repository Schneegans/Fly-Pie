//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const {GObject, GLib, Gtk, Gio, Gdk} = imports.gi;
const ByteArray                      = imports.byteArray;

// libadwaita is available starting with GNOME Shell 42.
let Adw = null;
try {
  Adw = imports.gi.Adw;
} catch (e) {
  // Nothing to do.
}

const _ = imports.gettext.domain('flypie').gettext;

const Me                 = imports.misc.extensionUtils.getCurrentExtension();
const utils              = Me.imports.src.common.utils;
const Statistics         = Me.imports.src.common.Statistics.Statistics;
const TutorialPage       = Me.imports.src.prefs.TutorialPage.TutorialPage;
const SettingsPage       = Me.imports.src.prefs.SettingsPage.SettingsPage;
const MenuEditorPage     = Me.imports.src.prefs.MenuEditorPage.MenuEditorPage;
const MenuEditor         = Me.imports.src.prefs.MenuEditor;
const IconSelectDialog   = Me.imports.src.prefs.IconSelectDialog;
const CopyValueButton    = Me.imports.src.prefs.CopyValueButton;
const ImageChooserButton = Me.imports.src.prefs.ImageChooserButton;
const AchievementsPage   = Me.imports.src.prefs.AchievementsPage.AchievementsPage;

//////////////////////////////////////////////////////////////////////////////////////////
// This class loads the user interface defined in settings.ui and instantiates the      //
// classes encapsulating code for the individual pages of the preferences dialog.       //
//////////////////////////////////////////////////////////////////////////////////////////

var PreferencesDialog = class PreferencesDialog {

  // ------------------------------------------------------------ constructor / destructor

  constructor() {

    // Create the Gio.Settings object.
    this._settings = utils.createSettings();

    // This we need to check whether ui animations are enabled.
    this._shellSettings = Gio.Settings.new('org.gnome.desktop.interface');

    // Load all of Fly-Pie's resources.
    this._resources = Gio.Resource.load(Me.path + '/resources/flypie.gresource');
    Gio.resources_register(this._resources);

    // Register some custom Gtk widgets. This needs to be done before creating the builder
    // below as this will instantiate some of these custom widgets.
    MenuEditor.registerWidgets();
    IconSelectDialog.registerWidget();
    ImageChooserButton.registerWidget();
    CopyValueButton.registerWidget();

    // Load the user interface file.
    this._builder = new Gtk.Builder();
    this._builder.add_from_resource(`/ui/${utils.gtk4() ? 'gtk4' : 'gtk3'}/settings.ui`);

    // Load the CSS file for the settings dialog.
    const styleProvider = Gtk.CssProvider.new();
    styleProvider.load_from_resource('/css/flypie.css');
    if (utils.gtk4()) {
      Gtk.StyleContext.add_provider_for_display(
          Gdk.Display.get_default(), styleProvider,
          Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
    } else {
      Gtk.StyleContext.add_provider_for_screen(
          Gdk.Screen.get_default(), styleProvider,
          Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
    }

    // To structure the source code, the code for the individual dialog pages has been put
    // into separate classes.

    // Initialize the Tutorial page.
    this._tutorialPage = new TutorialPage(this._builder, this._settings);

    // Initialize the Settings page.
    this._settingsPage = new SettingsPage(this._builder, this._settings);

    // Initialize the Menu Editor page.
    this._menuEditorPage = new MenuEditorPage(this._builder, this._settings);

    // Initialize the Achievements page.
    this._achievementsPage = new AchievementsPage(this._builder, this._settings);

    // Show current version number in about-popover.
    this._builder.get_object('app-name').label = 'Fly-Pie ' + Me.metadata.version;

    // There is a hidden achievement for viewing the sponsors page...
    this._builder.get_object('about-stack').connect('notify::visible-child-name', (o) => {
      if (o.visible_child_name == 'sponsors-page') {
        Statistics.getInstance().addSponsorsViewed();
      }
    });

    // Now add all contributors to the about-popover.
    {

      // This lambda adds a list of contributors to the given label.
      const addContributors = (labelID, contributors) => {
        // Do not touch the label if nothing needs to be done. This ensures that any
        // default state (like "- none -") is kept.
        if (Object.keys(contributors).length == 0) {
          return;
        }

        // Clear the label first.
        const label   = this._builder.get_object(labelID);
        label.label   = '';
        label.opacity = 1;

        // Then add a new line for each contributor.
        for (const [contributor, link] of Object.entries(contributors)) {
          if (link != '') {
            label.label += `<a href='${link}'>${contributor}</a>\n`;
          } else {
            label.label += `${contributor}\n`;
          }
        }

        // Remove the last newline.
        label.label = label.label.slice(0, label.label.length - 1);
      };

      // Add all contributors to the credits-page of the about-popover.
      const contributors = this._getJSONResource('/credits/contributors.json');
      addContributors('credits-created-by', contributors.code);
      addContributors('credits-artwork-by', contributors.artwork);

      // The JSON report format from weblate is a bit weird. Here we extract all unique
      // names from the translation report.
      const data        = this._getJSONResource('/credits/translators.json');
      const translators = {};
      data.forEach(i => {
        for (const j of Object.values(i)) {
          j.forEach(k => {
            translators[k[1]] = '';
          });
        }
      });

      addContributors('credits-translated-by', translators);

      // Add all sponsors to the sponsors page of the about-popover.
      const sponsors = this._getJSONResource('/credits/sponsors.json');
      addContributors('credits-gold-sponsors', sponsors.gold);
      addContributors('credits-silver-sponsors', sponsors.silver);
      addContributors('credits-bronze-sponsors', sponsors.bronze);
      addContributors('credits-past-sponsors', sponsors.past);
    }

    // Hide the in-app notification when its close button is pressed.
    this._builder.get_object('notification-close-button').connect('clicked', () => {
      this._builder.get_object('notification-revealer').reveal_child = false;
    });

    // We show an info bar if GNOME Shell's animations are disabled. To make this info
    // more apparent, we wait some seconds before showing it. On GNOME 40+, Fly-Pie also
    // works with animations disabled, so we do not need to show this there.
    if (!utils.shellVersionIsAtLeast(40, 0)) {
      this._showAnimationInfoTimeout =
          GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
            // Link the visibility of the info bar with the animations setting.
            this._shellSettings.bind(
                'enable-animations', this._builder.get_object('animation-infobar'),
                'revealed', Gio.SettingsBindFlags.INVERT_BOOLEAN);

            // Enable animations when the button in the info bar is pressed.
            this._builder.get_object('enable-animations-button')
                .connect('clicked', () => {
                  this._shellSettings.set_boolean('enable-animations', true);
                });

            this._showAnimationInfoTimeout = 0;
            return false;
          });
    }

    // This is our top-level widget which we will return later.
    this._widget = this._builder.get_object('main-notebook');

    // Because it looks cool, we add the stack switcher and the about button to the
    // window's title bar. We also make the bottom corners rounded.
    this._widget.connect('realize', () => {
      const stackSwitcher = this._builder.get_object('main-stack-switcher');
      const aboutButton   = this._builder.get_object('about-button');

      stackSwitcher.parent.remove(aboutButton);
      stackSwitcher.parent.remove(stackSwitcher);

      // On GNOME Shell 42, the settings dialog uses libadwaita. While the preferences
      // dialog could benefit from using libadwaita's widgets, maintaining three versions
      // of the UI is just too much work (GTK3 + GTK4 + libadwaita). So I chose to hack
      // the "features" of the AdwPreferencesWindow away... In the future, when libadwaita
      // is used more commonly, we should drop support for older GNOME versions and
      // rewrite the entire dialog using libadwaita widgets!
      if (utils.shellVersionIsAtLeast(42, 'beta')) {

        const window = this._widget.get_root().get_content();

        // Add widgets to the titlebar.
        const titlebar = this._findChildByType(window, Adw.HeaderBar);
        titlebar.set_title_widget(stackSwitcher);
        titlebar.pack_start(aboutButton);

        // "disable" the Adw.Clamp.
        const clamp        = this._findParentByType(this._widget, Adw.Clamp);
        clamp.maximum_size = 100000;

        // Disable the Gtk.ScrolledWindow.
        const scroll = this._findParentByType(this._widget, Gtk.ScrolledWindow);
        scroll.vscrollbar_policy = Gtk.PolicyType.NEVER;

      } else if (utils.gtk4()) {

        const titlebar = this._widget.get_root().get_titlebar();
        titlebar.set_title_widget(stackSwitcher);
        titlebar.pack_start(aboutButton);

        // This class makes the bottom corners round.
        this._widget.get_root().get_style_context().add_class('fly-pie-window');

      } else {

        const titlebar = this._widget.get_toplevel().get_titlebar();
        titlebar.set_custom_title(stackSwitcher);
        titlebar.pack_start(aboutButton);
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

    // On GTK3, we have to show the widgets.
    if (!utils.gtk4()) {
      this._widget.show_all();
      this._builder.get_object('about-popover').foreach(w => w.show_all());
      this._builder.get_object('preset-popover').foreach(w => w.show_all());
    }
  }

  // -------------------------------------------------------------------- public interface

  // Returns the widget used for the settings of this extension.
  getWidget() {
    return this._widget;
  }

  // ----------------------------------------------------------------------- private stuff

  // Reads the contents of a JSON file contained in the global resources archive. The data
  // is parsed and returned as a JavaScript object / array.
  _getJSONResource(path) {
    const data   = Gio.resources_lookup_data(path, 0);
    const string = ByteArray.toString(ByteArray.fromGBytes(data));
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