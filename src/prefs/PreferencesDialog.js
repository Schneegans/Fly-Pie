//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const {GLib, Gtk, Gio, Gdk} = imports.gi;

const Me               = imports.misc.extensionUtils.getCurrentExtension();
const utils            = Me.imports.src.common.utils;
const Statistics       = Me.imports.src.common.Statistics.Statistics;
const TutorialPage     = Me.imports.src.prefs.TutorialPage.TutorialPage;
const SettingsPage     = Me.imports.src.prefs.SettingsPage.SettingsPage;
const MenuEditorPage   = Me.imports.src.prefs.MenuEditorPage.MenuEditorPage;
const AchievementsPage = Me.imports.src.prefs.AchievementsPage.AchievementsPage;

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
    Gio.resources_register(Gio.Resource.load(Me.path + '/resources/flypie.gresource'));

    // Load the user interface file.
    this._builder = new Gtk.Builder();
    this._builder.add_from_resource('/ui/settings.ui');

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

    // // Initialize the Settings page.
    // this._settingsPage = new SettingsPage(this._builder, this._settings);

    // // Initialize the Menu Editor page.
    // this._menuEditorPage = new MenuEditorPage(this._builder, this._settings);

    // // Initialize the Achievements page.
    this._achievementsPage = new AchievementsPage(this._builder, this._settings);

    // Show current version number in about-popover.
    this._builder.get_object('app-name').label = 'Fly-Pie ' + Me.metadata.version;

    // We show an info bar if GNOME Shell's animations are disabled. To make this info
    // more apparent, we wait some seconds before showing it.
    this._showAnimationInfoTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
      // Link the visibility of the info bar with the animations setting.
      this._shellSettings.bind(
          'enable-animations', this._builder.get_object('animation-infobar'), 'revealed',
          Gio.SettingsBindFlags.INVERT_BOOLEAN);

      // Enable animations when the button in the info bar is pressed.
      this._builder.get_object('enable-animations-button').connect('clicked', () => {
        this._shellSettings.set_boolean('enable-animations', true);
      });

      this._showAnimationInfoTimeout = 0;
      return false;
    });

    // This is our top-level widget which we will return later.
    this._widget = this._builder.get_object('main-notebook');

    // Because it looks cool, we add the stack switcher and the about button to the
    // window's title bar.
    this._widget.connect('realize', () => {
      const stackSwitcher = this._builder.get_object('main-stack-switcher');
      const aboutButton   = this._builder.get_object('about-button');

      stackSwitcher.parent.remove(aboutButton);
      stackSwitcher.parent.remove(stackSwitcher);

      const titlebar = this._widget.get_root().get_titlebar();
      titlebar.set_title_widget(stackSwitcher);
      titlebar.pack_start(aboutButton);
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
      Statistics.cleanUp();

      // Disconnect some settings handlers of the individual pages.
      this._tutorialPage.destroy();
      this._settingsPage.destroy();
      this._achievementsPage.destroy();
    });

    // Record this construction for the statistics.
    Statistics.addSettingsOpened();
  }

  // -------------------------------------------------------------------- public interface

  // Returns the widget used for the settings of this extension.
  getWidget() {
    return this._widget;
  }
}