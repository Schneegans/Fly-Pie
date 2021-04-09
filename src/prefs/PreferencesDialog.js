//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const {GObject, GLib, Gtk, Gio, Gdk} = imports.gi;

const _ = imports.gettext.domain('flypie').gettext;

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

    this._registerCustomWidgets();

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

    // Initialize the Settings page.
    this._settingsPage = new SettingsPage(this._builder, this._settings);

    // Initialize the Menu Editor page.
    this._menuEditorPage = new MenuEditorPage(this._builder, this._settings);

    // Initialize the Achievements page.
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
    // window's title bar. We also make the bottom corners rounded.
    this._widget.connect('realize', () => {
      const stackSwitcher = this._builder.get_object('main-stack-switcher');
      const aboutButton   = this._builder.get_object('about-button');

      stackSwitcher.parent.remove(aboutButton);
      stackSwitcher.parent.remove(stackSwitcher);

      const titlebar = this._widget.get_root().get_titlebar();
      titlebar.set_title_widget(stackSwitcher);
      titlebar.pack_start(aboutButton);

      // This class makes the bottom corners round.
      this._widget.get_root().get_style_context().add_class('fly-pie-window');
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

  // ----------------------------------------------------------------------- private stuff

  _registerCustomWidgets() {

    if (GObject.type_from_name('FlyPieCopyValueButton') == null) {
      // clang-format off
      GObject.registerClass({
        GTypeName: 'FlyPieCopyValueButton',
        Template: 'resource:///ui/copyValueButton.ui',
      }, class FlyPieCopyValueButton extends Gtk.Button {});
      // clang-format on
    }

    if (GObject.type_from_name('FlyPieImageChooserButton') == null) {
      // clang-format off
      GObject.registerClass({
        GTypeName: 'FlyPieImageChooserButton',
        Template: 'resource:///ui/imageChooserButton.ui',
        InternalChildren: ['button', 'label', 'resetButton'],
        Signals: {
          'file-set': {}
        }
      },
      class FlyPieImageChooserButton extends Gtk.Box {
        // clang-format on
        _init(params = {}) {
          super._init(params);

          this._dialog = new Gtk.Dialog({use_header_bar: true, modal: true, title: ''});
          this._dialog.add_button(_('Select File'), Gtk.ResponseType.OK);
          this._dialog.add_button(_('Cancel'), Gtk.ResponseType.CANCEL);
          this._dialog.set_default_response(Gtk.ResponseType.OK);

          const fileFilter = new Gtk.FileFilter();
          fileFilter.add_mime_type('image/*');

          this._fileChooser = new Gtk.FileChooserWidget({
            action: Gtk.FileChooserAction.OPEN,
            hexpand: true,
            vexpand: true,
            height_request: 500,
            filter: fileFilter
          });

          this._dialog.get_content_area().append(this._fileChooser);

          this._dialog.connect('response', (dialog, id) => {
            if (id == Gtk.ResponseType.OK) {
              this.set_file(this._fileChooser.get_file());
              this.emit('file-set');
            }
            dialog.hide();
          });

          this._button.connect('clicked', (button) => {
            this._dialog.set_transient_for(button.get_root());
            this._dialog.show();
            if (this._file != null) {
              this._fileChooser.set_file(this._file);
            }
          });

          this._resetButton.connect('clicked', (button) => {
            this.set_file(null);
            this.emit('file-set');
          });
        }

        get_file() {
          return this._file;
        }

        set_file(value) {
          if (value != null && value.query_exists(null)) {
            this._label.label = value.get_basename();
          } else {
            this._label.label = _('(None)');
          }

          this._file = value;
        }
      });
    }

    if (GObject.type_from_name('FlyPieIconSelectDialog') == null) {
      // clang-format off
      GObject.registerClass({
        GTypeName: 'FlyPieIconSelectDialog',
        Template: 'resource:///ui/iconSelectDialog.ui',
        InternalChildren: ["stack", "iconFileChooser", "iconList", "iconView",
                          "spinner", "iconListFiltered", "filterEntry"],
        Signals: {
          'icon-set': {}
        }
      },
      class FlyPieIconSelectDialog extends Gtk.Dialog {
        // clang-format on
        _init(params = {}) {
          super._init(params);

          // Icons are loaded asynchronously. Once this is finished, the little spinner in
          // the top right of the dialog is hidden.
          this._loadIcons().then(() => {
            this._spinner.spinning = false;
          });

          // Filter the icon view based on the content of the search field.
          this._iconListFiltered.set_visible_func((model, iter) => {
            const name = model.get_value(iter, 0);
            if (name == null) {
              return false;
            }
            return name.toLowerCase().includes(this._filterEntry.text.toLowerCase());
          });

          // Refilter the icon list whenever the user types something in the search field.
          this._filterEntry.connect('notify::text', () => {
            this._iconListFiltered.refilter();
          });

          this._iconView.connect('item-activated', () => {
            this.emit('response', Gtk.ResponseType.OK);
          });
        }

        get_icon() {
          if (this._stack.get_visible_child_name() === 'icon-theme-page') {
            const path       = this._iconView.get_selected_items()[0];
            const model      = this._iconView.get_model();
            const [ok, iter] = model.get_iter(path);
            if (ok) {
              return model.get_value(iter, 0);
            }

            return '';
          }

          const file = this._iconFileChooser.get_file();
          if (file != null) {
            return file.get_path();
          }

          return '';
        }

        set_icon(value) {
          if (typeof value === 'string') {
            const file = Gio.File.new_for_path(value);
            if (file.query_exists(null)) {
              this._stack.set_visible_child_name('custom-icon-page');
              this._iconFileChooser.set_file(file);
            } else {
              this._stack.set_visible_child_name('icon-theme-page');
            }
          }
        }

        // This loads all icons of the current icon theme to the icon list of this
        // dialog. As this takes some time, it is done asynchronously. We do not check for
        // icon theme changes for now - this could be improved in the future!
        async _loadIcons() {

          // Disable sorting for now. Else this is horribly slow...
          this._iconList.set_sort_column_id(-2, Gtk.SortType.ASCENDING);

          const iconTheme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default());
          const icons     = iconTheme.get_icon_names();

          // We add icons in batches. This number is somewhat arbitrary - if reduced to 1,
          // the icon loading takes quite long, if increased further the user interface
          // gets a bit laggy during icon loading. Five seems to be a good compromise...
          const batchSize = 5;
          for (let i = 0; i < icons.length; i += batchSize) {
            for (let j = 0; j < batchSize && i + j < icons.length; j++) {
              this._iconList.set_value(this._iconList.append(), 0, icons[i + j]);
            }

            // This is effectively a 'yield'. We wait asynchronously for the timeout (1ms)
            // to resolve, letting other events to be processed in the meantime.
            await new Promise(r => GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1, r));
          }

          // Enable sorting again!
          this._iconList.set_sort_column_id(0, Gtk.SortType.ASCENDING);
        }
      });
    }
  }
}