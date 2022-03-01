//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const {GObject, Gdk, GLib, Gtk, Gio} = imports.gi;
const ByteArray                      = imports.byteArray;

const Me                  = imports.misc.extensionUtils.getCurrentExtension();
const utils               = Me.imports.src.common.utils;
const DBusInterface       = Me.imports.src.common.DBusInterface.DBusInterface;
const Statistics          = Me.imports.src.common.Statistics.Statistics;
const ItemRegistry        = Me.imports.src.common.ItemRegistry.ItemRegistry;
const ItemClass           = Me.imports.src.common.ItemRegistry.ItemClass;
const ConfigWidgetFactory = Me.imports.src.common.ConfigWidgetFactory.ConfigWidgetFactory;

const DBusWrapper = Gio.DBusProxy.makeProxyWrapper(DBusInterface.description);

const _ = imports.gettext.domain('flypie').gettext;

//////////////////////////////////////////////////////////////////////////////////////////
// The MenuEditorPage class encapsulates code required for the 'Menu Editor' page of    //
// the settings dialog. It's not instantiated multiple times, nor does it have any      //
// public interface, hence it could just be copy-pasted to the PreferencesDialog class. //
// But as it's quite decoupled (and huge) as well, it structures the code better when   //
// written to its own file.                                                             //
// Quite a lot of the menu editor logic is coded in the MenuEditor widget, which has    //
// its own class.                                                                       //
//////////////////////////////////////////////////////////////////////////////////////////

var MenuEditorPage = class MenuEditorPage {

  // ------------------------------------------------------------ constructor / destructor

  constructor(builder, settings) {

    // Keep a reference to the builder and the settings.
    this._builder  = builder;
    this._settings = settings;

    // This is later populated with a call to this._loadMenuConfiguration(). It basically
    // contains the content of the 'menu-configuration' settings key as a JavaScript
    // object.
    this._menuConfigs = [];

    // This array contains references to the nested list of currently edited menus. If no
    // menu is opened for editing, the array is empty. If a menu is opened,
    // this._menuPath[0] contains it toplevel menu and all further entries in
    // this._menuPath contain the opened child, grandchild and so on.
    this._menuPath = [];

    // This contains a reference to the currently selected child of the last item of the
    // _menuPath (if there is any, else it's null). This can also point to the last item
    // of the menuPath itself as this can be edited as well by selecting the center item.
    this._selectedItem = null;

    // This will be set to true while the settings sidebar is updated to show the data
    // from a newly selected item. This flag is then checked in the on-change signal
    // handlers of the sidebar widgets so that this does not create unnecessary update
    // calls.
    this._updatingSidebar = false;

    // Now we initialize several components of the menu editor.
    this._initEditor();
    this._initAddItemPopover();
    this._initPreviewButton();
    this._initExportImportButtons();
    this._initInfoLabel();
    this._initSettingsSidebar();

    // Now that the widgets are set up, we can load the entire menu configuration...
    try {
      this._loadMenuConfiguration();
    } catch (error) {
      utils.debug('Failed to load menu configuration: ' + error);
    }

    // ... and the configuration of all stashed items.
    try {
      this._loadStashConfiguration();
    } catch (error) {
      utils.debug('Failed to load stash configuration: ' + error);
    }
  }

  // ----------------------------------------------------------------------- private stuff

  // Initializes the popover which is shown when the tiny plus-symbol in the navigation
  // bar is clicked.
  _initAddItemPopover() {

    // Here we add one entry to the add-new-item popover for each registered item type.
    for (const type in ItemRegistry.getItemTypes()) {
      const row  = new Gtk.ListBoxRow({selectable: false});
      const grid = new Gtk.Grid({
        column_spacing: 8,
        margin_top: 4,
        margin_bottom: 4,
        margin_start: 4,
        margin_end: 10
      });

      const icon = new Gtk.DrawingArea();

      if (utils.gtk4()) {
        icon.content_width  = 32;
        icon.content_height = 32;
      } else {
        icon.width_request  = 32;
        icon.height_request = 32;
      }

      utils.setDrawFunc(icon, (widget, ctx) => {
        const size =
            Math.min(widget.get_allocated_width(), widget.get_allocated_height());
        const font  = this._settings.get_string('font');
        const color = utils.getColor(widget);
        utils.paintIcon(
            ctx, ItemRegistry.getItemTypes()[type].icon, size, 1, font, color);
        return false;
      });

      const name =
          new Gtk.Label({label: ItemRegistry.getItemTypes()[type].name, xalign: 0});
      const subtitle = new Gtk.Label({
        label: '<small>' + ItemRegistry.getItemTypes()[type].subtitle + '</small>',
        use_markup: true,
        xalign: 0
      });
      subtitle.get_style_context().add_class('dim-label');

      grid.attach(icon, 0, 0, 1, 2);
      grid.attach(name, 1, 0, 1, 1);
      grid.attach(subtitle, 1, 1, 1, 1);

      utils.setChild(row, grid);

      // The name is important - this is later used to identify the type of the
      // item which is to be created.
      row.set_name(type);

      // Add the new row either to the menus list or to the actions list.
      if (ItemRegistry.getItemTypes()[type].class == ItemClass.ACTION) {
        this._builder.get_object('add-action-list').insert(row, -1);
      } else {
        this._builder.get_object('add-menu-list').insert(row, -1);
      }
    }

    // Add a new item when one entry of the action-types list it activated.
    this._builder.get_object('add-action-list').connect('row-activated', (w, row) => {
      this._addDefaultItem(row.get_name());
      this._builder.get_object('add-item-popover').popdown();
    });

    // Add a new item when one entry of the menu-types list it activated.
    this._builder.get_object('add-menu-list').connect('row-activated', (w, row) => {
      this._addDefaultItem(row.get_name());
      this._builder.get_object('add-item-popover').popdown();
    });

    // Set the parent widget of the add-a-new-item popover.
    const popover = this._builder.get_object('add-item-popover');
    popover.connect('notify::visible', () => {
      const inMenuOverviewMode = this._menuPath.length == 0;

      this._builder.get_object('add-action-list').sensitive = !inMenuOverviewMode;
    });

    // On GTK3, we have to show the widgets.
    if (!utils.gtk4()) {
      popover.foreach(w => w.show_all());
    }
  }

  // Initialize the dialogs required for importing and exporting the menu configuration.
  _initExportImportButtons() {

    // Open a save-dialog when the export-config button is pressed.
    this._builder.get_object('export-menu-config-button').connect('clicked', (button) => {
      const dialog = new Gtk.FileChooserDialog({
        action: Gtk.FileChooserAction.SAVE,
        transient_for: utils.getRoot(button),
        modal: true
      });

      // Show only *.json files per default.
      const jsonFilter = new Gtk.FileFilter();
      jsonFilter.set_name(_('JSON Files'));
      jsonFilter.add_mime_type('application/json');
      dialog.add_filter(jsonFilter);

      // But allow showing all files if required.
      const allFilter = new Gtk.FileFilter();
      allFilter.add_pattern('*');
      allFilter.set_name(_('All Files'));
      dialog.add_filter(allFilter);

      // Add our action buttons.
      dialog.add_button(_('Cancel'), Gtk.ResponseType.CANCEL);
      dialog.add_button(_('Export'), Gtk.ResponseType.OK);

      // Export menu config when the OK button is clicked.
      dialog.connect('response', (dialog, response_id) => {
        if (response_id === Gtk.ResponseType.OK) {
          try {
            let path = dialog.get_file().get_path();

            // Make sure we have a *.json extension.
            if (!path.endsWith('.json')) {
              path += '.json';
            }

            // Now save the configuration!
            const config = JSON.parse(this._settings.get_string('menu-configuration'));
            const file   = Gio.File.new_for_path(path);
            file.replace_contents(
                JSON.stringify(config, null, 2), null, false,
                Gio.FileCreateFlags.REPLACE_DESTINATION, null);

            // Store this in our statistics.
            Statistics.getInstance().addMenuExport();

          } catch (error) {
            const errorMessage = new Gtk.MessageDialog({
              transient_for: utils.getRoot(button),
              modal: true,
              buttons: Gtk.ButtonsType.CLOSE,
              message_type: Gtk.MessageType.ERROR,
              text: _('Could not export the menu configuration.'),
              secondary_text: '' + error
            });
            errorMessage.connect('response', d => d.destroy());
            errorMessage.show();
          }
        }

        dialog.destroy();
      });

      // Showing the dialog is different on GTK3 / GTK4...
      if (utils.gtk4()) {
        dialog.show();
      } else {
        dialog.show_all();
      }
    });

    // Open a load-dialog when the import-config button is pressed.
    this._builder.get_object('import-menu-config-button').connect('clicked', (button) => {
      const dialog = new Gtk.FileChooserDialog({
        action: Gtk.FileChooserAction.OPEN,
        transient_for: utils.getRoot(button),
        modal: true
      });

      // Show only *.json files per default.
      const jsonFilter = new Gtk.FileFilter();
      jsonFilter.set_name(_('JSON Files'));
      jsonFilter.add_mime_type('application/json');
      dialog.add_filter(jsonFilter);

      // But allow showing all files if required.
      const allFilter = new Gtk.FileFilter();
      allFilter.add_pattern('*');
      allFilter.set_name(_('All Files'));
      dialog.add_filter(allFilter);

      // Add our action buttons.
      dialog.add_button(_('Cancel'), Gtk.ResponseType.CANCEL);
      dialog.add_button(_('Import'), Gtk.ResponseType.OK);

      // Import menu config when the OK button is clicked.
      dialog.connect('response', (dialog, response_id) => {
        if (response_id === Gtk.ResponseType.OK) {
          try {
            const file                = dialog.get_file();
            const [success, contents] = file.load_contents(null);

            // Load the configuration! We do a parse / stringify to catch any JSON errors
            // here. We also run the ItemRegistry.normalizeConfig() to catch some obvious
            // format errors.
            if (success) {
              const configs = JSON.parse(contents);

              if (!Array.isArray(configs)) {
                throw 'The JSON file should contain an array of menu configurations!';
              }

              configs.forEach(config => ItemRegistry.normalizeConfig(config));

              this._settings.set_string('menu-configuration', JSON.stringify(configs));
              this._loadMenuConfiguration();

              // Store this in our statistics.
              Statistics.getInstance().addMenuImport();
            }

          } catch (error) {
            const errorMessage = new Gtk.MessageDialog({
              transient_for: utils.getRoot(button),
              modal: true,
              buttons: Gtk.ButtonsType.CLOSE,
              message_type: Gtk.MessageType.ERROR,
              text: _('Could not import the menu configuration.'),
              secondary_text: '' + error
            });
            errorMessage.connect('response', d => d.destroy());
            errorMessage.show();
          }
        }

        dialog.destroy();
      });

      dialog.show();
    });
  }

  // Initialize the menu-preview button.
  _initPreviewButton() {

    // Connect to the server so that we can toggle menu previews from the menu editor.
    new DBusWrapper(
        Gio.DBus.session, 'org.gnome.Shell', '/org/gnome/shell/extensions/flypie',
        proxy => this._dbus = proxy);

    // Open a live-preview for the selected menu when the preview-button is clicked.
    this._builder.get_object('preview-menu-button').connect('clicked', () => {
      // The name of the menu is either the beginning of the menu path or (if we are in
      // overview mode) the name of the selected item.
      const name =
          this._menuPath.length > 0 ? this._menuPath[0].name : this._selectedItem.name;

      // Show the menu.
      this._dbus.PreviewMenuRemote(name, (result) => {
        result = parseInt(result);
        if (result < 0) {
          const error = DBusInterface.getErrorDescription(result);
          utils.debug('Failed to open menu preview: ' + error);
        } else {
          Statistics.getInstance().addPreviewMenuOpened();
        }
      });

      // Select the currently selected submenu also in the preview.
      if (this._menuPath.length > 0) {

        // First construct the path to the currently selected submenu.
        let path = '/';
        for (let i = 1; i < this._menuPath.length; i++) {
          const index = this._menuPath[i - 1].children.indexOf(this._menuPath[i]);
          path += index + '/';
        }

        // Then call the selectItem D-Bus method.
        this._dbus.SelectItemRemote(path, (result) => {
          result = parseInt(result);
          if (result < 0) {
            const error = DBusInterface.getErrorDescription(result);
            utils.debug('Failed to select an item in the menu preview: ' + error);
          }
        });
      }
    });
  }

  // There is a small label in the menu editor which shows random tips at regular
  // intervals.
  _initInfoLabel() {
    const revealer = this._builder.get_object('info-label-revealer');
    const label    = this._builder.get_object('info-label');

    const tips = [
      // Translators: This is one of the hints which are shown in the bottom right corner
      // of the menu editor.
      _('You should try to have no more than twelve items in your menus.'),
      // Translators: This is one of the hints which are shown in the bottom right corner
      // of the menu editor.
      _('An even number of entries will make it easier to learn item positions. Four, six and eight are good numbers.'),
      // Translators: This is one of the hints which are shown in the bottom right corner
      // of the menu editor.
      _('Fly-Pie is libre software available on <a href="%s">GitHub</a>.')
          .replace('%s', 'https://github.com/Schneegans/Fly-Pie'),
      // Translators: This is one of the hints which are shown in the bottom right corner
      // of the menu editor.
      _('Suggestions can be posted on <a href="%s">GitHub</a>.')
          .replace('%s', 'https://github.com/Schneegans/Fly-Pie/issues'),
      // Translators: This is one of the hints which are shown in the bottom right corner
      // of the menu editor.
      _('Bugs can be reported on <a href="%s">GitHub</a>.')
          .replace('%s', 'https://github.com/Schneegans/Fly-Pie/issues'),
      // Translators: This is one of the hints which are shown in the bottom right corner
      // of the menu editor.
      _('Keep menu hierarchies efficient by putting anything beyond 8 elements into a new menu level.'),
      // Translators: This is one of the hints which are shown in the bottom right corner
      // of the menu editor.
      _('If you delete all menus, log out and log in again, the default configuration will be restored.'),
      // Translators: This is one of the hints which are shown in the bottom right corner
      // of the menu editor.
      _('You can reorder the menu items on the left via drag and drop.'),
      // Translators: This is one of the hints which are shown in the bottom right corner
      // of the menu editor.
      _('It is possible to open a menu with a terminal command. You can read more on <a href="%s">Github</a>.')
          .replace(
              '%s',
              'https://github.com/Schneegans/Fly-Pie/blob/main/docs/dbus-interface.md'),
      // Translators: This is one of the hints which are shown in the bottom right corner
      // of the menu editor.
      _('You can drop directories, files, links and desktop files into the menu hierarchy on the left.'),
      // Translators: This is one of the hints which are shown in the bottom right corner
      // of the menu editor.
      _('On Wayland, you can copy menu items by holding the Ctrl key while dragging them to another location.'),
      // Translators: This is one of the hints which are shown in the bottom right corner
      // of the menu editor.
      _('<a href="%s">Translate Fly-Pie on Hosted Weblate</a>.')
          .replace(
              '%s',
              'https://github.com/Schneegans/Fly-Pie/blob/main/docs/translating.md'),
      // Translators: This is one of the hints which are shown in the bottom right corner
      // of the menu editor.
      _('💕️ Do you want to show your love for Fly-Pie? <a href="%s">Become a sponsor.</a>')
          .replace('%s', 'https://github.com/sponsors/Schneegans')
    ];

    // Every fifteen seconds we hide the current tip...
    this._infoLabelTimeoutB = null;
    this._infoLabelTimeoutA = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 10000, () => {
      revealer.reveal_child = false;

      // ...  and show a new tip some milliseconds later.
      this._infoLabelTimeoutB = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 250, () => {
        label.label             = tips[Math.floor(Math.random() * tips.length)];
        revealer.reveal_child   = true;
        this._infoLabelTimeoutB = null;

        return false;
      });

      // Don't show new tips when the window got closed.
      const showNext = utils.getRoot(label).visible;

      if (!showNext) {
        this._infoLabelTimeoutA = null;
        return false;
      }

      return true;
    });

    // Remove the timeouts when the dialog gets destroyed.
    label.connect('destroy', () => {
      if (this._infoLabelTimeoutA) {
        GLib.source_remove(this._infoLabelTimeoutA);
        this._infoLabelTimeoutA = null;
      }
      if (this._infoLabelTimeoutB) {
        GLib.source_remove(this._infoLabelTimeoutB);
        this._infoLabelTimeoutB = null;
      }
    });
  }

  // Initialize all widgets of the properties-sidebar.
  _initSettingsSidebar() {

    // First, we initialize the icon-select dialog.
    const iconSelectDialog = this._builder.get_object('icon-select-dialog');
    iconSelectDialog.connect('response', (dialog, id) => {
      if (id == Gtk.ResponseType.OK) {
        this._builder.get_object('icon-name').text = dialog.get_icon();
      }
      iconSelectDialog.hide();
    });

    // On GTK3, we have to show all children of the dialog manually.
    if (!utils.gtk4()) {
      iconSelectDialog.foreach(w => w.show_all());
    }

    // The icon-select dialog is shown when the corresponding button is pressed.
    this._builder.get_object('icon-select-button').connect('clicked', () => {
      iconSelectDialog.set_transient_for(
          utils.getRoot(this._builder.get_object('main-notebook')));
      iconSelectDialog.set_icon(this._builder.get_object('icon-name').text);
      iconSelectDialog.show();
    });

    // Initialize the icon at the top of the settings sidebar.
    utils.setDrawFunc(this._builder.get_object('item-icon-preview'), (widget, ctx) => {
      if (this._selectedItem) {
        const size =
            Math.min(widget.get_allocated_width(), widget.get_allocated_height());
        ctx.translate(
            (widget.get_allocated_width() - size) / 2,
            (widget.get_allocated_height() - size) / 2);
        const font  = this._settings.get_string('font');
        const color = utils.getColor(widget);
        utils.paintIcon(ctx, this._selectedItem.icon, size, 1, font, color);
      }
      return false;
    });

    // Redraw the icon when the icon name input field is changed. Also, save the menu
    // configuration and update the menu editor widget accordingly.
    this._builder.get_object('icon-name').connect('notify::text', (widget) => {
      if (!this._updatingSidebar && this._selectedItem) {
        this._selectedItem.icon = widget.text;
        this._editor.updateSelected(this._selectedItem);
        this._saveMenuConfiguration();
      }
      this._builder.get_object('item-icon-preview').queue_draw();
    });

    // Save the menu configuration and update the menu editor widget when the name of an
    // item is changed.
    this._builder.get_object('item-name').connect('notify::text', (widget) => {
      if (!this._updatingSidebar && this._selectedItem) {
        this._selectedItem.name = widget.text;
        this._editor.updateSelected(this._selectedItem);

        if (this._menuConfigs.indexOf(this._selectedItem) >= 0 &&
            this._menuPath.length > 0) {
          this._updateBreadCrumbs();
        }

        this._saveMenuConfiguration();
      }
    });

    // Update the item's fixed angle when the corresponding input field is changed. This
    // is a bit more involved, as we check for monotonically increasing angles among all
    // sibling items. We iterate through all children of the selected item's parent (that
    // means all siblings of the selected item). The minAngle is set to the largest fixed
    // angle amongst all siblings preceding the selected item; maxAngle is set to the
    // smallest fixed angle amongst siblings after the selected item.
    this._builder.get_object('item-angle').connect('notify::value', (adjustment) => {
      if (!this._updatingSidebar && this._selectedItem) {
        let minAngle = -1;
        let maxAngle = 360;

        const items         = this._getCurrentConfigs();
        const selectedIndex = items.indexOf(this._selectedItem);

        for (let i = 0; i < items.length; i++) {
          const angle = items[i].angle;

          if (i < selectedIndex && angle >= 0) {
            minAngle = angle;
          }

          if (i > selectedIndex && angle >= 0) {
            maxAngle = angle;
            break;
          }
        }

        // Set the value of the tree store only if the constraints are fulfilled.
        if (adjustment.value == -1 ||
            (adjustment.value > minAngle && adjustment.value < maxAngle)) {
          this._selectedItem.angle = adjustment.value;
          this._editor.updateSelected(this._selectedItem);
          this._editor.updateLayout();
          this._saveMenuConfiguration();
        }
      }
    });

    // For top-level menus, store whether they should be bound to Super + Right Mouse
    // Button. Only one menu can be bound to Super+RMB, therefore we unbind all others.
    this._builder.get_object('super-rmb').connect('notify::active', (widget) => {
      if (!this._updatingSidebar) {
        this._menuConfigs.forEach(config => config.superRMB = false);
        this._selectedItem.superRMB = widget.active;
        this._saveMenuConfiguration();
      }
    });

    // For top-level menus, store whether a touch button should be shown.
    this._builder.get_object('touch-button').connect('notify::active', (widget) => {
      if (!this._updatingSidebar) {
        this._selectedItem.touchButton = widget.active;

        // We reset the touch button's position when this setting is toggled. This means
        // if a touch button is disabled and then enabled again, it will be shown in the
        // middle of the screen again. This prevents that touch buttons get lost outside
        // of the screen area. This way, a user can always get them back.
        // First, we get the current positions list.
        const positions =
            this._settings.get_value('touch-button-positions').deep_unpack();

        // Then we reset the entry for the current menu.
        const index = this._menuConfigs.indexOf(this._selectedItem);
        if (positions.length > index && positions[index].length > 0) {
          positions[index] = [];
        }

        // Then we save the updated position list.
        const variant = new GLib.Variant('aah', positions);
        this._settings.set_value('touch-button-positions', variant);

        // Finally we store the updated menu configuration. This will trigger the
        // re-creation of all touch buttons.
        this._saveMenuConfiguration();
      }
    });

    // For top-level menus, store whether they should be opened in the center of the
    // screen.
    this._builder.get_object('menu-centered').connect('notify::active', (widget) => {
      if (!this._updatingSidebar) {
        this._selectedItem.centered = widget.active;
        this._saveMenuConfiguration();
      }
    });

    // Initialize the menu shortcut-select element. See the documentation of
    // ConfigWidgetFactory.createShortcutLabel for details.
    {
      const [box, label] = ConfigWidgetFactory.createShortcutLabel(false, (shortcut) => {
        if (!this._updatingSidebar) {
          this._selectedItem.shortcut = shortcut;
          this._editor.updateSelected(this._selectedItem);
          this._saveMenuConfiguration();
        }
      });
      utils.boxAppend(this._builder.get_object('menu-shortcut-box'), box);
      this._menuShortcutLabel = label;
    }
  }

  // Initialize the main menu editor widget.
  _initEditor() {

    // The menu editor class encapsulates a lot of logic already (especially drag-and-drop
    // behavior), however, we have to connect to several signals to wire everything up.
    this._editor = this._builder.get_object('menu-editor');

    // If an item is selected, we update the settings sidebar accordingly.
    this._editor.connect('select-item', (e, which) => {
      if (which >= 0) {
        this._selectedItem = this._getCurrentConfigs()[which];
      } else {
        this._selectedItem = this._menuPath[this._menuPath.length - 1];
      }
      this._updateSidebar();
    });

    // If an item is selected for editing, we push it to the menu path, update sidebar and
    // breadcrumbs, and make the menu editor show the newly visible children.
    this._editor.connect('edit-item', (e, which) => {
      this._selectedItem = this._getCurrentConfigs()[which];
      this._menuPath.push(this._selectedItem);
      this._updateSidebar();
      this._updateBreadCrumbs();
      this._editor.setItems(
          this._selectedItem.children, -1, this._selectedItem,
          this._getCurrentParentAngle());
    });

    // If an item is removed, we may have to hide the sidebar and we will save the
    // resulting menu configuration.
    this._editor.connect('remove-item', (e, which) => {
      const [removed] = this._getCurrentConfigs().splice(which, 1);
      if (removed == this._selectedItem) {
        this._selectedItem = null;
        this._updateSidebar();
      }
      this._saveMenuConfiguration();
    });

    // If an item was dropped onto the menu editor, we add an item accordingly. This is
    // not considered to be an item creation in terms of statistics, as it's most likely
    // the result of a drag-and-drop operation.
    this._editor.connect('drop-item', (e, what, where) => {
      const config = JSON.parse(what);
      this._addItem(config, where);
    });

    // If arbitrary text is dropped onto the editor, we try our best to create a suitable
    // action.
    this._editor.connect('drop-data', (e, what, where) => {
      this._addItem(ItemRegistry.createActionConfig(what), where);

      // Store this in our statistics.
      Statistics.getInstance().addItemCreated();
    });

    // If an item was dropped into another item of the menu editor, we add an item
    // accordingly. This is not considered to be an item creation in terms of statistics,
    // as it's most likely the result of a drag-and-drop operation.
    this._editor.connect('drop-item-into', (e, what, where) => {
      this._addItemAsChild(JSON.parse(what), where);
    });

    // If arbitrary text is dropped into another item of the editor, we try our best to
    // create a suitable action.
    this._editor.connect('drop-data-into', (e, what, where) => {
      this._addItemAsChild(ItemRegistry.createActionConfig(what), where);

      // Store this in our statistics.
      Statistics.getInstance().addItemCreated();
    });

    // When the back-button is clicked, we go back one step in the menu path.
    this._editor.connect('go-back', () => {
      this._gotoMenuPathIndex(this._menuPath.length - 2);
    });

    // When a notification is supposed to be shown, we do it!
    this._editor.connect('notification', (e, text) => this._showNotification(text));

    // Initialize the drop target of the trash area. It's pretty simple, it just accepts
    // any internal drag operation. Only slight differences between GTK3 and GTK4...
    {
      const trash = this._builder.get_object('menu-editor-trash');

      if (utils.gtk4()) {
        const dropTarget = new Gtk.DropTarget({actions: Gdk.DragAction.MOVE});
        dropTarget.set_gtypes([GObject.TYPE_STRING]);
        dropTarget.connect('accept', (d, drop) => drop.get_drag() != null);
        dropTarget.connect('drop', () => true);
        dropTarget.connect('motion', () => Gdk.DragAction.MOVE);
        trash.add_controller(dropTarget);
      } else {
        trash.drag_dest_set(
            Gtk.DestDefaults.ALL,
            [Gtk.TargetEntry.new('FLY-PIE-ITEM', Gtk.TargetFlags.SAME_APP, 0)],
            Gdk.DragAction.MOVE);
      }
    }

    // The stash area is slightly more complex, as a new stash widget needs to be created
    // on drop events. Only slight differences between GTK3 and GTK4...
    {
      const stash = this._builder.get_object('menu-editor-stash');

      const handler = (value) => {
        const config = JSON.parse(value);
        this._stashedConfigs.push(config);
        this._addStashWidget(config);
        this._saveStashConfiguration();
        return true;
      };

      if (utils.gtk4()) {
        const dropTarget =
            new Gtk.DropTarget({actions: Gdk.DragAction.MOVE | Gdk.DragAction.COPY});
        dropTarget.set_gtypes([GObject.TYPE_STRING]);
        dropTarget.connect('accept', (d, drop) => drop.get_drag() != null);
        dropTarget.connect('drop', (t, value) => handler(value));
        dropTarget.connect('motion', () => Gdk.DragAction.MOVE);
        stash.add_controller(dropTarget);
      } else {
        stash.drag_dest_set(
            Gtk.DestDefaults.ALL,
            [Gtk.TargetEntry.new('FLY-PIE-ITEM', Gtk.TargetFlags.SAME_APP, 0)],
            Gdk.DragAction.MOVE | Gdk.DragAction.COPY);
        stash.connect('drag-data-received', (w, context, x, y, data, i, time) => {
          handler(ByteArray.toString(data.get_data()));
        });
        stash.connect('drag-motion', (w, context, x, y, time) => {
          // Make sure to choose the copy action if Ctrl is held down.
          const pointer = Gdk.Display.get_default().get_default_seat().get_pointer();
          const mods    = w.get_window().get_device_position(pointer)[3];

          if (mods & Gdk.ModifierType.CONTROL_MASK) {
            Gdk.drag_status(context, Gdk.DragAction.COPY, time);
          } else {
            Gdk.drag_status(context, Gdk.DragAction.MOVE, time);
          }

          return true;
        });
      }
    }
  }

  // Overrides the currently displayed tip in the info-label with the given text. After
  // several seconds, a new random tip will be shown.
  _showInfoLabel(text) {

    // Clear any pending timeouts.
    if (this._infoLabelTimeoutA) {
      GLib.source_remove(this._infoLabelTimeoutA);
      this._infoLabelTimeoutA = null;
    }
    if (this._infoLabelTimeoutB) {
      GLib.source_remove(this._infoLabelTimeoutB);
      this._infoLabelTimeoutB = null;
    }

    // Show the given text.
    this._builder.get_object('info-label').label = text;

    // Re-initialize the info label; this will make it show the next tip after a couple of
    // seconds.
    this._initInfoLabel();
  }

  // When the currently selected menu item changes, the content of the settings
  // widgets must be updated accordingly.
  _updateSidebar() {

    // There are multiple Gtk.Revealers involved. Based on the selected item's type
    // their content is either shown or hidden. The menu settings (shortcut, centered) are
    // visible if a top-level element is selected, for all other items the fixed angle can
    // be set.
    const somethingSelected = this._selectedItem != null;
    const toplevelSelected  = this._menuConfigs.indexOf(this._selectedItem) >= 0;

    this._builder.get_object('item-settings-revealer').reveal_child = somethingSelected;

    this._builder.get_object('item-settings-menu-revealer').reveal_child =
        toplevelSelected;

    // The angle cannot be modified for center items.
    this._builder.get_object('item-settings-angle-revealer').reveal_child =
        !toplevelSelected &&
        this._selectedItem != this._menuPath[this._menuPath.length - 1];

    // Make the preview button non-sensitive if nothing is selected.
    this._builder.get_object('preview-menu-button').sensitive =
        somethingSelected || this._menuPath.length > 0;

    if (somethingSelected) {

      // This prevents an update feedback back to the menu editor as long as this method
      // is executed.
      this._updatingSidebar = true;

      // The item's name, icon and description have to be updated in any case if
      // something is selected.
      this._builder.get_object('icon-name').text = this._selectedItem.icon;
      this._builder.get_object('item-name').text = this._selectedItem.name;

      // Show the description of the selected type in the info label.
      const selectedType = this._selectedItem.type;
      this._showInfoLabel(ItemRegistry.getItemTypes()[selectedType].description);

      // If the selected item is a top-level menu, update the shortcut, else the item
      // angle.
      if (toplevelSelected) {
        this._menuShortcutLabel.set_accelerator(this._selectedItem.shortcut || '');
        this._builder.get_object('menu-centered').active = this._selectedItem.centered;
        this._builder.get_object('touch-button').active  = this._selectedItem.touchButton;
        this._builder.get_object('super-rmb').active     = this._selectedItem.superRMB;
      } else {
        this._builder.get_object('item-angle').value = this._selectedItem.angle;
      }

      // Now we check whether the selected item has a config property.
      const config = ItemRegistry.getItemTypes()[selectedType].config;

      // If it has a config property, we can show the revealer for the config widget.
      const revealer        = this._builder.get_object('item-settings-config-revealer');
      revealer.reveal_child = config != null;

      // In this case, we also ask the config object to create a new configuration
      // widget for the selected type.
      if (config) {

        // Then we create and add the new configuration widget. The callback will be
        // fired when the user changes the data. "data" will contain an object with custom
        // properties, optionally the name and icon of the currently selected item can be
        // changed as well (e.g. when an application is selected, we want to change the
        // item's name and icon accordingly).
        const newChild = config.getWidget(this._selectedItem.data, (data, name, icon) => {
          if (!this._updatingSidebar) {
            this._selectedItem.data = data;

            if (name != null) {
              this._builder.get_object('item-name').text = name;
            }

            if (icon != null) {
              this._builder.get_object('icon-name').text = icon;
            }

            this._saveMenuConfiguration();
          }
        });

        // We have to show the new child on GTK3 manually.
        if (!utils.gtk4()) {
          newChild.show_all();
        }

        utils.setChild(revealer, newChild);
      }

      this._updatingSidebar = false;
    }
  }

  // This updates the menu path visualization at the top of the menu editor. It shows the
  // current selection chain and allow for navigating to parent levels.
  _updateBreadCrumbs() {

    const container = this._builder.get_object('menu-editor-breadcrumbs');

    // Clear the container first.
    utils.clearChildren(container);

    // As first item we always create a home button which leads to the menu overview.
    {
      const button = new Gtk.Button();
      utils.addCSSClass(button, 'menu-editor-path-item');

      // Interaction is only possible if there is a menu currently in edit mode.
      if (this._menuPath.length > 0) {
        button.connect('clicked', () => {
          this._gotoMenuPathIndex(-1);
        });

        // This handler creates a new toplevel menu item based on the provided config.
        const dragDrop = (value) => {
          const config = JSON.parse(value);
          if (ItemRegistry.getItemTypes()[config.type].class != ItemClass.MENU) {
            // Translators: This is shown as an in-app notification when the user
            // attempts to drag an action in the menu editor to the menu overview.
            this._showNotification(_('Actions cannot be turned into toplevel menus.'));
            return false;
          }

          // Its fixed angle is reset to prevent invalid configurations.
          config.angle = -1;

          this._menuConfigs.push(config);
          this._saveMenuConfiguration();

          return true;
        };

        // Things need to be wired up differently on GTK3 / GTK4.
        if (utils.gtk4()) {
          const dropTarget =
              new Gtk.DropTarget({actions: Gdk.DragAction.MOVE | Gdk.DragAction.COPY});
          dropTarget.set_gtypes([GObject.TYPE_STRING]);
          dropTarget.connect('motion', () => Gdk.DragAction.MOVE);
          dropTarget.connect('accept', (d, drop) => drop.get_drag() != null);
          dropTarget.connect('drop', (t, what) => {
            return dragDrop(what);
          });

          button.add_controller(dropTarget);

        } else {

          button.drag_dest_set(
              Gtk.DestDefaults.HIGHLIGHT,
              [Gtk.TargetEntry.new('FLY-PIE-ITEM', Gtk.TargetFlags.SAME_APP, 0)],
              Gdk.DragAction.MOVE | Gdk.DragAction.COPY);
          button.drag_dest_set_track_motion(true);

          button.connect('drag-data-received', (w, context, x, y, data, i, time) => {
            const success = dragDrop(ByteArray.toString(data.get_data()));
            Gtk.drag_finish(
                context, success, context.get_selected_action() == Gdk.DragAction.MOVE,
                time);
          });

          button.connect('drag-drop', (w, context, x, y, time) => {
            button.drag_get_data(context, 'FLY-PIE-ITEM', time);
          });

          button.connect('drag-motion', (w, context, x, y, time) => {
            // Make sure to choose the copy action if Ctrl is held down.
            const pointer = Gdk.Display.get_default().get_default_seat().get_pointer();
            const mods    = w.get_window().get_device_position(pointer)[3];

            if (mods & Gdk.ModifierType.CONTROL_MASK) {
              Gdk.drag_status(context, Gdk.DragAction.COPY, time);
            } else {
              Gdk.drag_status(context, Gdk.DragAction.MOVE, time);
            }

            return true;
          });
        }
      }

      const box = new Gtk.Box();
      // Translators: The left-most item of the menu editor bread crumbs.
      const label = new Gtk.Label({label: _('All Menus')});
      const icon  = new Gtk.Image({icon_name: 'flypie-overview-symbolic', margin_end: 4});
      utils.boxAppend(box, icon);
      utils.boxAppend(box, label);
      utils.setChild(button, box);

      utils.boxAppend(container, button);
    }

    // Now add a button for each entry of the menu path.
    for (let i = 0; i < this._menuPath.length; i++) {
      const item   = this._menuPath[i];
      const label  = new Gtk.Label({label: item.name});
      const button = new Gtk.Button();
      if (this._menuPath.length > i + 1) {
        button.connect('clicked', () => {
          this._gotoMenuPathIndex(i);
        });

        const dragDrop = (value) => {
          const config = JSON.parse(value);

          // Its fixed angle is reset to prevent invalid configurations.
          config.angle = -1;

          item.children.push(config);
          this._saveMenuConfiguration();

          return true;
        };

        // Things need to be wired up differently on GTK3 / GTK4.
        if (utils.gtk4()) {
          const dropTarget =
              new Gtk.DropTarget({actions: Gdk.DragAction.MOVE | Gdk.DragAction.COPY});
          dropTarget.set_gtypes([GObject.TYPE_STRING]);
          dropTarget.connect('accept', (d, drop) => drop.get_drag() != null);
          dropTarget.connect('drop', (t, what) => dragDrop(what));
          dropTarget.connect('motion', () => Gdk.DragAction.MOVE);
          button.add_controller(dropTarget);

        } else {

          button.drag_dest_set(
              Gtk.DestDefaults.ALL,
              [Gtk.TargetEntry.new('FLY-PIE-ITEM', Gtk.TargetFlags.SAME_APP, 0)],
              Gdk.DragAction.MOVE | Gdk.DragAction.COPY);

          button.connect('drag-data-received', (w, context, x, y, data, i, time) => {
            dragDrop(ByteArray.toString(data.get_data()));
          });
          button.connect('drag-motion', (w, context, x, y, time) => {
            // Make sure to choose the copy action if Ctrl is held down.
            const pointer = Gdk.Display.get_default().get_default_seat().get_pointer();
            const mods    = w.get_window().get_device_position(pointer)[3];

            if (mods & Gdk.ModifierType.CONTROL_MASK) {
              Gdk.drag_status(context, Gdk.DragAction.COPY, time);
            } else {
              Gdk.drag_status(context, Gdk.DragAction.MOVE, time);
            }

            return true;
          });
        }
      }
      utils.addCSSClass(button, 'menu-editor-path-item');
      utils.setChild(button, label);
      utils.boxAppend(container, button);
    }

    // Show the breadcrumbs manually on GTK3.
    if (!utils.gtk4()) {
      container.show_all();
    }
  }

  // If index < 0, the menu overview will be shown. If i+1>=menuPath.length, nothing will
  // happen. For all indices between, the corresponding menu will be opened in the editor
  // and the previously opened child menu will be selected.
  _gotoMenuPathIndex(index) {
    if (index + 1 >= this._menuPath.length) {
      return;
    }

    // Got to the menu overview.
    if (index < 0) {

      // Make the previously edited menu the selected child.
      let selectedIndex = -1;
      if (this._menuPath.length > 0) {
        this._selectedItem = this._menuPath[0];
        selectedIndex      = this._menuConfigs.indexOf(this._menuPath[0]);
      }

      this._editor.setItems(this._menuConfigs, selectedIndex);

      this._menuPath = [];
      this._updateBreadCrumbs();
      this._updateSidebar();

    } else {

      const newItem      = this._menuPath[index];
      const previousItem = this._menuPath[index + 1];

      // Make the previously edited menu the selected child.
      const selectedIndex   = newItem.children.indexOf(previousItem);
      this._selectedItem    = previousItem;
      this._menuPath.length = index + 1;
      this._updateBreadCrumbs();
      this._updateSidebar();
      this._editor.setItems(
          newItem.children, selectedIndex, newItem, this._getCurrentParentAngle());
    }
  }

  // Adds a new item of the given type to the currently edited menu (or to the menu
  // overview).
  _addDefaultItem(type) {
    const config = ItemRegistry.createDefaultConfig(type);

    // Assign a new ID for top-level items.
    if (this._menuPath.length == 0) {
      config.id       = this._getNewID();
      config.shortcut = '';
    } else {
      config.angle = -1;
    }

    // Append to the current item list.
    const configs = this._getCurrentConfigs();
    this._addItem(config, configs.length);

    // Store this in our statistics.
    Statistics.getInstance().addItemCreated();
  }

  // Adds an item based on the given config at the specified index to the menu editor. It
  // will be the selected item; the sidebar widgets will be updated to reflect the item
  // configuration. Its fixed angle is reset to prevent invalid configurations.
  _addItem(config, where) {
    config.angle = -1;
    this._editor.addItem(config, where);
    this._selectedItem = config;
    this._getCurrentConfigs().splice(where, 0, config);
    this._updateSidebar();
    this._saveMenuConfiguration();
  }

  // Adds an item based on the given config as child of the item at the specified index.
  // The parent item will be the selected item; the sidebar widgets will be updated to
  // reflect the item configuration. Its fixed angle is reset to prevent invalid
  // configurations.
  _addItemAsChild(config, where) {
    config.angle = -1;
    const parent = this._getCurrentConfigs()[where];
    parent.children.push(config);
    this._selectedItem = parent;
    this._updateSidebar();
    this._saveMenuConfiguration();
  }

  // Add the item given with the config object to the stash.
  _addStashWidget(config) {
    this._builder.get_object('menu-editor-stash-label').visible   = false;
    this._builder.get_object('menu-editor-stash-content').visible = true;

    // Stash items are simple Gtk.DrawingAreas which can be dragged around.
    const item = new Gtk.DrawingArea({
      margin_start: 4,
      margin_end: 4,
      valign: Gtk.Align.CENTER,
      tooltip_text: config.name
    });

    if (utils.gtk4()) {
      item.content_width  = 32;
      item.content_height = 32;
    } else {
      item.width_request  = 32;
      item.height_request = 32;
    }

    item.config = config;
    utils.setDrawFunc(item, (widget, ctx) => {
      const size  = Math.min(widget.get_allocated_width(), widget.get_allocated_height());
      const font  = this._settings.get_string('font');
      const color = utils.getColor(widget);
      utils.paintIcon(ctx, widget.config.icon, size, 1, font, color);
      return false;
    });
    utils.boxAppend(this._builder.get_object('menu-editor-stash-content'), item);

    // Make the item translucent when a drag is started.
    const dragBegin = () => {
      item.opacity = 0.2;
    };

    // Remove the stash widget on a successful drop.
    const dragDeleteData = () => {
      let removeIndex = this._stashedConfigs.indexOf(config);
      this._stashedConfigs.splice(removeIndex, 1);

      if (utils.gtk4()) {
        item.unparent();
      } else {
        this._builder.get_object('menu-editor-stash-content').remove(item);
      }

      this._saveStashConfiguration();

      // Show the stash info when the last item got deleted.
      if (this._stashedConfigs.length == 0) {
        this._builder.get_object('menu-editor-stash-label').visible   = true;
        this._builder.get_object('menu-editor-stash-content').visible = false;
      }
    };

    // Make the item visible again if the drag is aborted.
    const dragEnd = () => {
      item.opacity = 1;
      return false;
    };

    // Things need to be wired up differently on GTK3 / GTK4.
    if (utils.gtk4()) {

      // Do to https://gitlab.gnome.org/GNOME/gtk/-/issues/4259, copy does not work on
      // X11.
      // If we added the copy action on X11, it would be chosen as default action and the
      // user would have to hold down shift in order to move items...
      let actions = Gdk.DragAction.MOVE;
      if (utils.getSessionType() == 'wayland') {
        actions |= Gdk.DragAction.COPY;
      }

      const dragSource = new Gtk.DragSource({actions: actions});

      dragSource.connect('prepare', (s, x, y) => {
        s.set_icon(Gtk.WidgetPaintable.new(item), x, y);
        return Gdk.ContentProvider.new_for_value(JSON.stringify(config));
      });

      dragSource.connect('drag-end', (s, drag, deleteData) => {
        if (deleteData) {
          dragDeleteData();
        } else {
          dragEnd();
        }
      });

      dragSource.connect('drag-begin', dragBegin);
      dragSource.connect('drag-cancel', dragEnd);

      item.add_controller(dragSource);

    } else {

      item.drag_source_set(
          Gdk.ModifierType.BUTTON1_MASK,
          [Gtk.TargetEntry.new('FLY-PIE-ITEM', Gtk.TargetFlags.SAME_APP, 0)],
          Gdk.DragAction.MOVE | Gdk.DragAction.COPY);

      // The item's icon is used as drag graphic.
      item.connect('drag-begin', () => {
        const font    = this._settings.get_string('font');
        const color   = utils.getColor(item);
        const size    = Math.min(item.width_request, item.height_request);
        const surface = utils.createIcon(config.icon, size, font, color);
        const pixbuf  = Gdk.pixbuf_get_from_surface(surface, 0, 0, size, size);
        item.drag_source_set_icon_pixbuf(pixbuf);
        dragBegin();
      });

      item.connect('drag-data-delete', dragDeleteData);
      item.connect('drag-failed', dragEnd);
      item.connect('drag-end', dragEnd);
      item.connect('drag-data-get', (w, c, data) => {
        data.set('FLY-PIE-ITEM', 8, ByteArray.fromString(JSON.stringify(config)));
      });

      item.show();
    }
  }

  // Returns the configurations of the items which are currently displayed in the menu
  // editor.
  _getCurrentConfigs() {
    if (this._menuPath.length == 0) {
      return this._menuConfigs;
    }
    return this._menuPath[this._menuPath.length - 1].children;
  }

  // Computes the angle of the current center item relative to its parent menu.
  _getCurrentParentAngle() {
    if (this._menuPath.length <= 1) {
      return undefined;
    }

    let itemAngles = utils.computeItemAngles(this._menuPath[0].children);

    // Iterate through the menu path from start to end.
    for (let i = 1; i < this._menuPath.length; i++) {
      let parentAngle =
          itemAngles[this._menuPath[i - 1].children.indexOf(this._menuPath[i])];
      parentAngle = (parentAngle + 180) % 360;

      if (i == this._menuPath.length - 1) {
        return parentAngle
      } else {
        itemAngles = utils.computeItemAngles(this._menuPath[i].children, parentAngle);
      }
    }
  }

  // This returns an integer > 0 which is not used as menu ID currently.
  _getNewID() {
    let newID   = -1;
    let isInUse = false;

    do {
      ++newID;
      isInUse = false;

      for (let i = 0; i < this._menuConfigs.length; i++) {
        if (this._menuConfigs[i].id != undefined && this._menuConfigs[i].id == newID) {
          isInUse = true;
          break;
        }
      }

    } while (isInUse);

    return newID;
  }

  // This is called once initially and loads the JSON menu configuration from the settings
  // key "menu-configuration". This may throw an exception if the currently stored menu
  // configuration is invalid.
  _loadMenuConfiguration() {

    // Clear any previous selection.
    this._menuPath = [];

    // Load the menu configuration in the JSON format.
    this._menuConfigs = JSON.parse(this._settings.get_string('menu-configuration'));

    for (let i = 0; i < this._menuConfigs.length; i++) {

      // Make sure that all fields of the menu config are initialized to sane defaults.
      ItemRegistry.normalizeConfig(this._menuConfigs[i]);

      // If, for some reason, no ID is assigned to a menu, generate a new one.
      if (this._menuConfigs[i].id == undefined) {
        this._menuConfigs[i].id = this._getNewID();
      }
    }

    // Then we add all menus to the editor.
    this._editor.setItems(this._menuConfigs);

    this._updateBreadCrumbs();
  }

  // This is called once initially and loads the JSON item configurations from the
  // settings key "stashed-items". This may throw an exception if the stored item
  // configuration is invalid.
  _loadStashConfiguration() {

    // Load the menu configuration in the JSON format.
    this._stashedConfigs = JSON.parse(this._settings.get_string('stashed-items'));

    // And all stashed items to the stash widget.
    for (let i = 0; i < this._stashedConfigs.length; i++) {
      this._addStashWidget(this._stashedConfigs[i]);
    }

    // Show the stash label if there are no stashed items.
    if (!utils.gtk4()) {
      if (this._stashedConfigs.length == 0) {
        this._builder.get_object('menu-editor-stash-label').visible = true;
      }
    }
  }

  // This stores a JSON representation of the current configuration in the
  // "menu-configuration" key of the application settings. This is called whenever
  // something is changed in the sidebar. It does not update the settings
  // instantaneously, it rather waits a few milliseconds for any additional changes.
  _saveMenuConfiguration() {

    // The configuration changed again. Cancel any pending save tasks...
    if (this._saveSettingsTimeout != null) {
      GLib.source_remove(this._saveSettingsTimeout);
      this._saveSettingsTimeout = null;
    }

    // ... and launch a new one.
    this._saveSettingsTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 10, () => {
      this._saveSettingsTimeout = null;

      // Save the configuration as JSON!
      this._settings.set_string('menu-configuration', JSON.stringify(this._menuConfigs));

      if (this._menuConfigs.length == 0) {
        Statistics.getInstance().addDeletedAllMenus();
      }

      return false;
    });
  }

  // This stores a JSON representation of the currently stashed items in the
  // "stashed-items" key of the application settings. It does not update the settings
  // instantaneously, it rather waits a few milliseconds for any additional changes.
  _saveStashConfiguration() {

    // The configuration changed again. Cancel any pending save tasks...
    if (this._saveStashTimeout != null) {
      GLib.source_remove(this._saveStashTimeout);
      this._saveStashTimeout = null;
    }

    // ... and launch a new one.
    this._saveStashTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 10, () => {
      this._saveStashTimeout = null;

      // Save the configuration as JSON!
      this._settings.set_string('stashed-items', JSON.stringify(this._stashedConfigs));

      return false;
    });
  }

  // Shows an in-app notification with the given text.
  _showNotification(text) {
    this._builder.get_object('notification-revealer').reveal_child = true;
    this._builder.get_object('notification-label').label           = text;
  }
}
