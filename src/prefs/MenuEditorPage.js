//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Cairo                                     = imports.cairo;
const {GObject, Gdk, GLib, Gtk, Gio, GdkPixbuf} = imports.gi;

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

    // Then we add all menus to the editor.
    this._editor.setItems(this._menuConfigs);

    // And all stashed items to the stash widget.
    for (let i = 0; i < this._stashedConfigs.length; i++) {
      this._addStashItem(this._stashedConfigs[i]);
    }

    this._updateBreadCrumbs();
  }

  // ----------------------------------------------------------------------- private stuff

  _initAddItemPopover() {

    // First, we initialize the add-new-item popover and the related buttons.
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
      const icon = new Gtk.Image(
          {icon_name: ItemRegistry.getItemTypes()[type].icon, pixel_size: 32});
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

      row.set_child(grid);

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
    this._builder.get_object('add-action-list')
        .connect('row-activated', (widget, row) => {
          this._addNewItem(row.get_name());
          this._builder.get_object('add-item-popover').popdown();
        });

    // Add a new item when one entry of the menu-types list it activated.
    this._builder.get_object('add-menu-list').connect('row-activated', (widget, row) => {
      this._addNewItem(row.get_name());
      this._builder.get_object('add-item-popover').popdown();
    });

    // Set the parent widget of the add-a-new-item popover.
    const popover = this._builder.get_object('add-item-popover');
    popover.set_parent(this._editor);
  }

  _initExportImportButtons() {

    // Open a save-dialog when the export-config button is pressed.
    this._builder.get_object('export-menu-config-button').connect('clicked', (button) => {
      const dialog = new Gtk.FileChooserDialog({
        title: _('Export Menu Configuration'),
        action: Gtk.FileChooserAction.SAVE,
        transient_for: button.get_root(),
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
              transient_for: button.get_root(),
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

      dialog.show();
    });

    // Open a load-dialog when the import-config button is pressed.
    this._builder.get_object('import-menu-config-button').connect('clicked', (button) => {
      const dialog = new Gtk.FileChooserDialog({
        title: _('Import Menu Configuration'),
        action: Gtk.FileChooserAction.OPEN,
        transient_for: button.get_root(),
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
            // here.
            if (success) {
              const config = JSON.parse(contents);
              this._settings.set_string('menu-configuration', JSON.stringify(config));
              this._loadMenuConfiguration();

              // Store this in our statistics.
              Statistics.getInstance().addMenuImport();
            }

          } catch (error) {
            const errorMessage = new Gtk.MessageDialog({
              transient_for: button.get_root(),
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

  _initPreviewButton() {

    // Connect to the server so that we can toggle menu previews from the menu editor.
    new DBusWrapper(
        Gio.DBus.session, 'org.gnome.Shell', '/org/gnome/shell/extensions/flypie',
        proxy => this._dbus = proxy);

    // Open a live-preview for the selected menu when the preview-button is clicked.
    this._builder.get_object('preview-menu-button').connect('clicked', () => {
      const name =
          this._menuPath.length > 0 ? this._menuPath[0].name : this._selectedItem.name;
      this._dbus.PreviewMenuRemote(name, (result) => {
        result = parseInt(result);
        if (result < 0) {
          const error = DBusInterface.getErrorDescription(result);
          utils.debug('Failed to open menu preview: ' + error);
        } else {
          Statistics.getInstance().addPreviewMenuOpened();
        }
      });
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
      _('You can drop directories, files, links and desktop files into the menu hierarchy on the left.'),
      // Translators: This is one of the hints which are shown in the bottom right corner
      // of the menu editor.
      _('You can copy menu items by holding the Ctrl key while dragging them to another location.'),
      // Translators: This is one of the hints which are shown in the bottom right corner
      // of the menu editor.
      _('<a href="%s">Translate Fly-Pie on Hosted Weblate</a>.')
          .replace(
              '%s',
              'https://github.com/Schneegans/Fly-Pie/blob/develop/docs/translating.md'),
      // Translators: This is one of the hints which are shown in the bottom right corner
      // of the menu editor.
      _('💕️ Do you want to show your love for Fly-Pie? <a href="%s">Become a sponsor.</a>')
          .replace('%s', 'https://github.com/sponsors/Schneegans')
    ];

    // Every fifteen seconds we hide the current tip...
    this._infoLabelTimeoutB = null;
    this._infoLabelTimeoutA = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 15000, () => {
      revealer.reveal_child = false;

      // ...  and show a new tip some milliseconds later.
      this._infoLabelTimeoutB = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 250, () => {
        label.label           = tips[Math.floor(Math.random() * tips.length)];
        revealer.reveal_child = true;
        return false;
      });

      // Don't show new tips when the window got closed.
      return label.get_root().visible;
    });

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

  _showInfoLabel(text) {
    if (this._infoLabelTimeoutA) {
      GLib.source_remove(this._infoLabelTimeoutA);
      this._infoLabelTimeoutA = null;
    }
    if (this._infoLabelTimeoutB) {
      GLib.source_remove(this._infoLabelTimeoutB);
      this._infoLabelTimeoutB = null;
    }

    this._builder.get_object('info-label').label = text;

    this._initInfoLabel();
  }

  _initSettingsSidebar() {

    // Now we initialize all icon-related UI elements. That is first and foremost the
    // icon-select dialog.
    const iconSelectDialog = this._builder.get_object('icon-select-dialog');
    iconSelectDialog.connect('response', (dialog, id) => {
      if (id == Gtk.ResponseType.OK) {
        this._builder.get_object('icon-name').text = dialog.get_icon();
      }
      iconSelectDialog.hide();
    });

    this._builder.get_object('icon-select-button').connect('clicked', () => {
      iconSelectDialog.set_transient_for(
          this._builder.get_object('main-notebook').get_root());
      iconSelectDialog.set_icon(this._builder.get_object('icon-name').text);
      iconSelectDialog.show();
    });

    // Redraw the icon when the icon name input field is changed. Also, store the new
    // icon name in the tree store. This will lead to a re-draw of the icon in the tree
    // view as well.
    this._builder.get_object('icon-name').connect('notify::text', (widget) => {
      this._selectedItem.icon = widget.text;
      this._editor.updateSelected(this._selectedItem);
      this._saveMenuConfiguration();
    });

    // Store the item's name in the tree store when the text of the name input field is
    // changed.this.
    this._builder.get_object('item-name').connect('notify::text', (widget) => {
      this._selectedItem.name = widget.text;
      this._editor.updateSelected(this._selectedItem);

      if (this._menuConfigs.indexOf(this._selectedItem) >= 0 &&
          this._menuPath.length > 0) {
        this._updateBreadCrumbs();
      }

      this._saveMenuConfiguration();
    });

    // For top-level menus, store whether they should be opened in the center of the
    // screen.
    this._builder.get_object('menu-centered').connect('notify::active', (widget) => {
      this._selectedItem.centered = widget.active;
      this._saveMenuConfiguration();
    });

    // Store the item's fixed angle in the tree store's ANGLE column when the
    // corresponding input field is changed. This is a bit more involved, as we check
    // for monotonically increasing angles among all sibling items. We iterate through
    // all children of the selected item's parent (that means all siblings of the
    // selected item). The minAngle is set to the largest fixed angle amongst all
    // siblings preceding the selected item; maxAngle is set to the smallest fixed angle
    // amongst siblings after the selected item.
    // this._builder.get_object('item-angle').connect('value-changed', (adjustment) => {
    //   let minAngle = -1;
    //   let maxAngle = 360;

    //   const [ok1, model, selectedIter] = this._selection.get_selected();
    //   if (!ok1) return;

    //   const [ok2, parentIter] = model.iter_parent(selectedIter);
    //   if (!ok2) return;

    //   const selectedIndices = model.get_path(selectedIter).get_indices();
    //   const selectedIndex   = selectedIndices[selectedIndices.length - 1];
    //   const nChildren       = model.iter_n_children(parentIter);

    //   for (let n = 0; n < nChildren; n++) {
    //     const angle = this._get(model.iter_nth_child(parentIter, n)[1], 'ANGLE');

    //     if (n < selectedIndex && angle >= 0) {
    //       minAngle = angle;
    //     }

    //     if (n > selectedIndex && angle >= 0) {
    //       maxAngle = angle;
    //       break;
    //     }
    //   }

    //   // Set the value of the tree store only if the constraints are fulfilled.
    //   if (adjustment.value == -1 ||
    //       (adjustment.value > minAngle && adjustment.value < maxAngle)) {
    //     this._setSelected('ANGLE', adjustment.value);
    //   }
    // });

    // Initialize the menu shortcut-select element. See the documentation of
    // createShortcutLabel for details.
    {
      const [box, label] = ConfigWidgetFactory.createShortcutLabel(false, (shortcut) => {
        this._selectedItem.shortcut = shortcut;
        this._editor.updateSelected(this._selectedItem);
        this._saveMenuConfiguration();
      });
      this._builder.get_object('menu-shortcut-box').append(box);
      this._menuShortcutLabel = label;
    }
  }

  _initEditor() {

    this._editor = this._builder.get_object('menu-editor');

    this._editor.connect('select', (e, which) => {
      if (which >= 0) {
        this._selectedItem = this._getCurrentConfigs()[which];
      } else {
        this._selectedItem = this._menuPath[this._menuPath.length - 1];
      }
      this._updateSidebar();
    });

    this._editor.connect('edit', (e, which) => {
      this._selectedItem = this._getCurrentConfigs()[which];
      this._menuPath.push(this._selectedItem);
      this._updateSidebar();
      this._updateBreadCrumbs();
      this._editor.setItems(this._selectedItem.children, this._selectedItem, -1);
    });

    this._editor.connect('remove', (e, which) => {
      const [removed] = this._getCurrentConfigs().splice(which, 1);
      if (removed == this._selectedItem) {
        this._selectedItem = null;
        this._updateSidebar();
      }
      this._saveMenuConfiguration();
    });

    this._editor.connect('drop-item', (e, what, where) => {
      const config = JSON.parse(what);
      this._editor.add(config, where);
      this._selectedItem = config;
      this._getCurrentConfigs().splice(where, 0, config);
      this._updateSidebar();
      this._saveMenuConfiguration();
    });

    this._editor.connect('drop-data', (e, what, where) => {
      const config = ItemRegistry.createActionConfig(what);
      this._editor.add(config, where);
      this._selectedItem = config;
      this._getCurrentConfigs().splice(where, 0, config);
      this._updateSidebar();
      this._saveMenuConfiguration();
    });

    this._editor.connect('drop-item-into', (e, what, where) => {
      const config = JSON.parse(what);
      const parent = this._getCurrentConfigs()[where];
      parent.children.push(config);
      this._selectedItem = parent;
      this._updateSidebar();
      this._saveMenuConfiguration();
    });

    this._editor.connect('drop-data-into', (e, what, where) => {
      const config = ItemRegistry.createActionConfig(what);
      const parent = this._getCurrentConfigs()[where];
      parent.children.push(config);
      this._selectedItem = parent;
      this._updateSidebar();
      this._saveMenuConfiguration();
    });

    this._editor.connect('request-add', (e, rect) => {
      const inMenuOverviewMode = this._menuPath.length == 0;

      this._builder.get_object('add-action-list').visible     = !inMenuOverviewMode;
      this._builder.get_object('action-list-heading').visible = !inMenuOverviewMode;
      this._builder.get_object('menu-list-heading').visible   = !inMenuOverviewMode;
      const popover = this._builder.get_object('add-item-popover');
      popover.set_pointing_to(rect);
      popover.popup();
    });

    this._editor.connect('notification', (e, text) => this._showNotification(text));

    {
      const trash = this._builder.get_object('menu-editor-trash');
      const dropTarget =
          new Gtk.DropTarget({actions: Gdk.DragAction.MOVE | Gdk.DragAction.COPY});
      dropTarget.set_gtypes([GObject.TYPE_STRING]);
      dropTarget.connect('accept', (d, drop) => drop.get_drag() != null);
      dropTarget.connect('drop', () => true);
      dropTarget.connect('motion', () => Gdk.DragAction.MOVE);
      trash.add_controller(dropTarget);
    }

    {
      const stash = this._builder.get_object('menu-editor-stash');
      const dropTarget =
          new Gtk.DropTarget({actions: Gdk.DragAction.MOVE | Gdk.DragAction.COPY});
      dropTarget.set_gtypes([GObject.TYPE_STRING]);
      dropTarget.connect('accept', (d, drop) => drop.get_drag() != null);
      dropTarget.connect('drop', (t, value) => {
        const config = JSON.parse(value);
        this._stashedConfigs.push(config);
        this._addStashItem(config);
        this._saveStashConfiguration();
        return true;
      });
      dropTarget.connect('motion', () => Gdk.DragAction.MOVE);
      stash.add_controller(dropTarget);
    }
  }

  _getCurrentConfigs() {
    if (this._menuPath.length == 0) {
      return this._menuConfigs;
    }
    return this._menuPath[this._menuPath.length - 1].children;
  }


  // This is called once initially and loads the JSON menu configuration from the settings
  // key "menu-configuration". This may throw an exception if the currently stored menu
  // configuration is invalid.
  _loadMenuConfiguration() {

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
  }

  // This is called once initially and loads the JSON item configurations from the
  // settings key "stashed-items". This may throw an exception if the stored item
  // configuration is invalid.
  _loadStashConfiguration() {

    // Load the menu configuration in the JSON format.
    this._stashedConfigs = JSON.parse(this._settings.get_string('stashed-items'));

    for (let i = 0; i < this._stashedConfigs.length; i++) {

      // Make sure that all fields of the menu config are initialized to sane defaults.
      ItemRegistry.normalizeConfig(this._stashedConfigs[i]);
    }
  }

  // When the currently selected menu item changes, the content of the settings
  // widgets must be updated accordingly.
  _updateSidebar() {
    // There are multiple Gtk.Revealers involved. Based on the selected item's type
    // their content is either shown or hidden. The menu settings (shortcut, centered) are
    // visible if a top-level element is selected, for all other items the fixed angle can
    // be set.
    const sometingSelected = this._selectedItem != null;
    const toplevelSelected = this._menuConfigs.indexOf(this._selectedItem) >= 0;

    this._builder.get_object('item-settings-revealer').reveal_child = sometingSelected;
    this._builder.get_object('item-settings-menu-revealer').reveal_child =
        toplevelSelected;
    this._builder.get_object('preview-menu-button').sensitive =
        sometingSelected || this._menuPath.length > 0;

    if (sometingSelected) {

      const selectedType = this._selectedItem.type;

      // If rows are not yet fully added, it may happen that the type is not yet set.
      if (selectedType == null) {
        return;
      }

      // The item's name, icon and description have to be updated in any case if
      // something is selected.
      this._builder.get_object('icon-name').text = this._selectedItem.icon;
      this._builder.get_object('item-name').text = this._selectedItem.name;
      this._showInfoLabel(ItemRegistry.getItemTypes()[selectedType].description);

      // If the selected item is a top-level menu, the SHORTCUT column contains its
      // shortcut.
      if (toplevelSelected) {
        this._menuShortcutLabel.set_accelerator(this._selectedItem.shortcut || '');
        this._builder.get_object('menu-centered').active = this._selectedItem.centered;
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
          this._selectedItem.data = data;

          if (name) {
            this._builder.get_object('item-name').text = name;
          }

          if (icon) {
            this._builder.get_object('icon-name').text = icon;
          }

          this._saveMenuConfiguration();
        });

        revealer.set_child(newChild);
      }
    }
  }

  // This updates the menu path visualization at the top of the menu editor. It shows the
  // current selection chain and allow for navigating to parent levels.
  _updateBreadCrumbs() {

    const container = this._builder.get_object('menu-editor-breadcrumbs');

    // Clear the container first.
    while (container.get_first_child() != null) {
      container.remove(container.get_first_child());
    }

    const button = new Gtk.Button();
    button.add_css_class('menu-editor-path-item');
    if (this._menuPath.length > 0) {
      button.connect('clicked', () => {
        const selectedIndex = this._menuConfigs.indexOf(this._menuPath[0]);
        this._editor.setItems(this._menuConfigs, null, selectedIndex);
        this._selectedItem = this._menuPath[0];
        this._menuPath     = [];
        this._updateBreadCrumbs();
        this._updateSidebar();
      });

      const dropTarget =
          new Gtk.DropTarget({actions: Gdk.DragAction.MOVE | Gdk.DragAction.COPY});
      dropTarget.set_gtypes([GObject.TYPE_STRING]);
      dropTarget.connect('accept', (d, drop) => drop.get_drag() != null);
      dropTarget.connect('drop', (t, what) => {
        const config = JSON.parse(what);
        if (ItemRegistry.getItemTypes()[config.type].class != ItemClass.MENU) {
          // Translators: This is shown as an in-app notification when the user attempts
          // to drag an action in the menu editor to the menu overview.
          this._showNotification(_('Actions cannot be turned into toplevel menus.'));
          return false;
        }
        this._menuConfigs.push(config);
        this._saveMenuConfiguration();
        return true;
      });
      dropTarget.connect('motion', () => Gdk.DragAction.MOVE);
      button.add_controller(dropTarget);
    }

    const box = new Gtk.Box();
    // Translators: The left-most item of the menu editor bread crumbs.
    const label = new Gtk.Label({label: _('All Menus')});
    const icon  = new Gtk.Image({icon_name: 'go-home-symbolic', margin_end: 4});
    box.append(icon);
    box.append(label);
    button.set_child(box);

    container.append(button);

    for (let i = 0; i < this._menuPath.length; i++) {
      const item   = this._menuPath[i];
      const label  = new Gtk.Label({label: item.name});
      const button = new Gtk.Button();
      if (this._menuPath.length > i + 1) {
        button.connect('clicked', () => {
          const selectedIndex = item.children.indexOf(this._menuPath[i + 1]);
          this._editor.setItems(item.children, item, selectedIndex);
          this._selectedItem    = this._menuPath[i + 1];
          this._menuPath.length = i + 1;
          this._updateBreadCrumbs();
          this._updateSidebar();
        });
        const dropTarget =
            new Gtk.DropTarget({actions: Gdk.DragAction.MOVE | Gdk.DragAction.COPY});
        dropTarget.set_gtypes([GObject.TYPE_STRING]);
        dropTarget.connect('accept', (d, drop) => drop.get_drag() != null);
        dropTarget.connect('drop', (t, what) => {
          const config = JSON.parse(what);
          item.children.push(config);
          this._saveMenuConfiguration();
          return true;
        });
        dropTarget.connect('motion', () => Gdk.DragAction.MOVE);
        button.add_controller(dropTarget);
      }
      button.add_css_class('menu-editor-path-item');
      button.set_child(label);
      container.append(button);
    }
  }

  // This adds a new menu item to the currently selected menu. Items will always be
  // inserted as a sibling following the currently selected item. This is except for
  // action items added to top-level menus, here we add them as a child.
  _addNewItem(newType) {

    const toplevelSelected = this._menuPath.length == 0;

    const newItem = {
      name: ItemRegistry.getItemTypes()[newType].name,
      type: newType,
    };

    // Assign default children and icons.
    if (newType == 'CustomMenu') {
      newItem.children = [];
      newItem.icon     = this._getRandomEmoji();
    } else {
      newItem.icon = ItemRegistry.getItemTypes()[newType].icon;
    }

    // Assign a new ID for top-level items.
    if (toplevelSelected) {
      newItem.id       = this._getNewID();
      newItem.shortcut = '';
    }

    // Assign default custom data.
    if (ItemRegistry.getItemTypes()[newType].config != undefined) {
      newItem.data = ItemRegistry.getItemTypes()[newType].config.defaultData;
    }

    const configs = this._getCurrentConfigs();
    configs.push(newItem);

    this._selectedItem = newItem;
    this._editor.add(newItem, configs.length - 1);
    this._saveMenuConfiguration();
    this._updateSidebar();

    // Store this in our statistics.
    Statistics.getInstance().addItemCreated();
  }

  _addStashItem(config) {
    this._builder.get_object('menu-editor-stash-label').visible   = false;
    this._builder.get_object('menu-editor-stash-content').visible = true;

    const item  = new Gtk.DrawingArea({
      content_width: 32,
      content_height: 32,
      valign: Gtk.Align.CENTER,
      margin_top: 4,
      margin_bottom: 4,
      margin_start: 4,
      margin_end: 4,
      tooltip_text: config.name
    });
    item.config = config;
    item.set_draw_func((widget, ctx) => {
      const size  = Math.min(widget.get_allocated_width(), widget.get_allocated_height());
      const font  = this._settings.get_string('font');
      const color = widget.get_style_context().get_color();
      utils.paintIcon(ctx, widget.config.icon, size, 1, font, color);
      return false;
    });
    this._builder.get_object('menu-editor-stash-content').append(item);

    const dragSource =
        new Gtk.DragSource({actions: Gdk.DragAction.MOVE | Gdk.DragAction.COPY});
    dragSource.connect('prepare', (s, x, y) => {
      s.set_icon(Gtk.WidgetPaintable.new(item), x, y);
      return Gdk.ContentProvider.new_for_value(JSON.stringify(config));
    });
    dragSource.connect('drag-begin', () => {
      item.opacity = 0.2;
    });
    dragSource.connect('drag-end', (s, drag, deleteData) => {
      if (deleteData) {
        let removeIndex = this._stashedConfigs.indexOf(config);
        this._stashedConfigs.splice(removeIndex, 1);
        item.unparent();
        this._saveStashConfiguration();

        if (this._stashedConfigs.length == 0) {
          this._builder.get_object('menu-editor-stash-label').visible   = true;
          this._builder.get_object('menu-editor-stash-content').visible = false;
        }
      } else {
        item.opacity = 1;
      }
    });
    dragSource.connect('drag-cancel', (s, drag, reason) => {
      item.opacity = 1;
      return false;
    });

    item.add_controller(dragSource);
  }

  // This is a little helper to make creating new menus more fun. New menus
  // will get a random emoji as a icon!
  _getRandomEmoji() {
    let emojis = [
      ...'💾🐹💞😀🎂🌞🥇💗🌟🐣🔧🌍🐈🍩💕🦔🤣📝🥂💥😁🎉💖😎😛🐸🍕☕🍺🍰🗿'
    ];

    // The +0 is a little hack - else emojis.length is not recognized as a number?!
    return emojis[Math.floor(Math.random() * (emojis.length + 0))];
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

  _showNotification(text) {
    this._builder.get_object('notification-revealer').reveal_child = true;
    this._builder.get_object('notification-label').label           = text;
  }
}
