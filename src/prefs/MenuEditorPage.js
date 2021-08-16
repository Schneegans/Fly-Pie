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

    // This is the canvas where the editable menu is drawn to. It's a custom container
    // widget and we use standard widgets such as GtkLabels and GtkButtons to draw the
    // menu.
    this._editor = this._builder.get_object('menu-editor');

    // This is later populated with a call to this._loadMenuConfiguration(). It basically
    // contains the content of the 'menu-configuration' settings key as a JavaScript
    // object.
    this._configs = [];

    // This array contains the indices of the current selection chain. If no menu is
    // selected for editing, the array is empty. If a menu is currently edited,
    // this._selectionChain[0] will contain the index of the menu in this._configs. All
    // further entries in this._selectionChain contain the indices of the selected child,
    // grandchild and so on.
    this._selectionChain = [];

    // Now we initialize several components of the menu editor.
    this._initAddItemPopover();
    this._initPreviewButton();
    this._initExportImportButtons();
    this._initBreadCrumbs();
    this._initInfoLabel();
    this._initSettingsSidebar();

    // Now that the widgets are set up, we can load the entire menu configuration...
    try {
      this._loadMenuConfiguration();
    } catch (error) {
      utils.debug('Failed to load menu configuration: ' + error);
    }

    // ... and draw the menu overview!
    this._redraw();
  }

  // ----------------------------------------------------------------------- private stuff


  // The breadcrumbs are an GtkLabel that shows the current selection chain and allows for
  // back navigation. Each item is a clickable link, the URI contains an integer to which
  // the length of the selection chain must be truncated in order to select it.
  _initBreadCrumbs() {
    this._breadCrumbs = this._builder.get_object('menu-editor-breadcrumbs');
    this._breadCrumbs.connect('activate-link', (label, uri) => {
      this._selectionChain.length = parseInt(uri);
      this._redraw();
      return true;
    });
  }

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
        this._builder.get_object('action-types-list').insert(row, -1);
      } else {
        this._builder.get_object('menu-types-list').insert(row, -1);
      }
    }

    // Add a new item when one entry of the action-types list it activated.
    this._builder.get_object('action-types-list')
        .connect('row-activated', (widget, row) => {
          this._addNewItem(row.get_name());
          this._builder.get_object('item-type-popover').popdown();
        });

    // Add a new item when one entry of the menu-types list it activated.
    this._builder.get_object('menu-types-list')
        .connect('row-activated', (widget, row) => {
          this._addNewItem(row.get_name());
          this._builder.get_object('item-type-popover').popdown();
        });
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
      let [ok, model, iter] = this._selection.get_selected();

      if (ok) {
        const menuIndex = model.get_path(iter).get_indices()[0];
        [ok, iter]      = model.get_iter(Gtk.TreePath.new_from_indices([menuIndex]));
        const menuName  = this._get(iter, 'NAME');
        this._dbus.PreviewMenuRemote(menuName, (result) => {
          result = parseInt(result);
          if (result < 0) {
            const error = DBusInterface.getErrorDescription(result);
            utils.debug('Failed to open menu preview: ' + error);
          } else {
            Statistics.getInstance().addPreviewMenuOpened();
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

    // Every eight seconds we hide the current tip...
    this._infoLabelTimeoutB = null;
    this._infoLabelTimeoutA = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 8000, () => {
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
      GLib.source_remove(this._infoLabelTimeoutA);
      GLib.source_remove(this._infoLabelTimeoutB);
    });
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

    // Draw an icon to the drawing area whenever it's invalidated. This happens usually
    // when the text of the icon name input field changes.
    this._builder.get_object('item-icon-drawingarea').set_draw_func((widget, ctx) => {
      const size  = Math.min(widget.get_allocated_width(), widget.get_allocated_height());
      const icon  = this._getSelected('ICON');
      const font  = this._settings.get_string('font');
      const color = widget.get_style_context().get_color();
      if (icon && icon.length > 0) {
        utils.paintIcon(ctx, icon, size, 1, font, color);
      }
      return false;
    });

    // Redraw the icon when the icon name input field is changed. Also, store the new
    // icon name in the tree store. This will lead to a re-draw of the icon in the tree
    // view as well.
    this._builder.get_object('icon-name').connect('notify::text', (widget) => {
      // this._setSelected('ICON', widget.text);
      this._builder.get_object('item-icon-drawingarea').queue_draw();
    });

    // Store the item's name in the tree store when the text of the name input field is
    // changed.
    this._builder.get_object('item-name')
        .connect(
            'notify::text',
            (widget) => {
                // this._setSelected('NAME', widget.text);
            });

    // For top-level menus, store whether they should be opened in the center of the
    // screen.
    this._builder.get_object('menu-centered')
        .connect(
            'notify::active',
            (widget) => {
                // this._setSelected('CENTERED', widget.active);
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
        this._setSelected('SHORTCUT', shortcut);
      });
      this._builder.get_object('menu-shortcut-box').append(box);
      this._menuShortcutLabel = label;
    }

    // // When the currently selected menu item changes, the content of the settings
    // widgets
    // // must be updated accordingly.
    // this._selection.connect('changed', (selection) => {
    //   // Some widgets are disabled if nothing is selected.
    //   let somethingSelected = selection.get_selected()[0];
    //   this._builder.get_object('preview-menu-button').sensitive = somethingSelected;
    //   this._builder.get_object('remove-item-button').sensitive  = somethingSelected;

    //   // The action types list is only available if something is selected and if a
    //   // top-level element is selected, this must be a custom menu.
    //   let actionsSensitive = somethingSelected;
    //   if (this._isToplevelSelected()) {
    //     actionsSensitive = this._getSelected('TYPE') == 'CustomMenu';
    //   }
    //   this._builder.get_object('action-types-list').sensitive = actionsSensitive;

    //   // There are multiple Gtk.Revealers involved. Based on the selected item's type
    //   // their content is either shown or hidden. All settings are invisible if nothing
    //   is
    //   // selected, the menu settings (shortcut, centered) are visible if a top-level
    //   // element is selected, for all other items the fixed angle can be set.
    //   this._builder.get_object('item-settings-revealer').reveal_child =
    //   somethingSelected;
    //   this._builder.get_object('item-settings-menu-revealer').reveal_child =
    //       this._isToplevelSelected();
    //   this._builder.get_object('item-settings-angle-revealer').reveal_child =
    //       !this._isToplevelSelected();

    //   if (somethingSelected) {

    //     const selectedType = this._getSelected('TYPE');

    //     // If rows are not yet fully added, it may happen that the type is not yet set.
    //     if (selectedType == null) {
    //       return;
    //     }

    //     // Setting the content of the widgets below will actually trigger menu
    //     treestore
    //     // modifications which in turn would lead to saving the menu configuration. As
    //     // this is not necessary, we disable saving temporarily.
    //     this._menuSavingAllowed = false;

    //     // The item's name, icon and description have to be updated in any case if
    //     // something is selected.
    //     this._builder.get_object('icon-name').text = this._getSelected('ICON');
    //     this._builder.get_object('item-name').text = this._getSelected('NAME');
    //     this._builder.get_object('item-description').label =
    //         ItemRegistry.getItemTypes()[selectedType].description;

    //     // If the selected item is a top-level menu, the SHORTCUT column contains its
    //     // shortcut.
    //     if (this._isToplevelSelected()) {
    //       this._menuShortcutLabel.set_accelerator(this._getSelected('SHORTCUT'));
    //       this._builder.get_object('menu-centered').active =
    //           this._getSelected('CENTERED');
    //     }
    //     // For all other items, the fixed angle can be set.
    //     else {
    //       this._builder.get_object('item-angle').value = this._getSelected('ANGLE');
    //     }

    //     // Now we check whether the selected item has a config property.
    //     const config = ItemRegistry.getItemTypes()[selectedType].config;

    //     // If it has a config property, we can show the revealer for the config widget.
    //     const revealer        =
    //     this._builder.get_object('item-settings-config-revealer');
    //     revealer.reveal_child = config != null;

    //     // In this case, we also ask the config object to create a new configuration
    //     // widget for the selected type.
    //     if (config) {

    //       // To populate the new configuration widget with data, we retrieve the data
    //       from
    //       // the tree store's data column. This **should** be a JSON string, but if
    //       // someone tries to load a config from Fly-Pie 4 or older, this may not be
    //       the
    //       // case. So we print a warning in this case.
    //       let data = this._getSelected('DATA');
    //       try {
    //         data = JSON.parse(data);
    //       } catch (error) {
    //         utils.debug(
    //             'Warning: Invalid configuration data is stored for the selected item: '
    //             + error);
    //       }

    //       // Then we create and add the new configuration widget. The callback will be
    //       // fired when the user changes the data. "data" will contain an object which
    //       is
    //       // to be stored as JSON string, optionally the name and icon of the currently
    //       // selected item can be changed as well (e.g. when an application is
    //       selected,
    //       // we want to change the item's name and icon accordingly).
    //       const newChild = config.getWidget(data, (data, name, icon) => {
    //         this._setSelected('DATA', JSON.stringify(data));

    //         if (name) {
    //           this._builder.get_object('item-name').text = name;
    //         }

    //         if (icon) {
    //           this._builder.get_object('icon-name').text = icon;
    //         }
    //       });

    //       revealer.set_child(newChild);
    //     }

    //     // All modifications are done, all future modifications will come from the user
    //     // and should result in saving the configuration again.
    //     this._menuSavingAllowed = true;
    //   }
    // });
  }


  // This is called once initially and loads the JSON menu configuration from the settings
  // key "menu-configuration". This may throw an exception if the currently stored menu
  // configuration is invalid.
  _loadMenuConfiguration() {

    // Load the menu configuration in the JSON format.
    this._configs = JSON.parse(this._settings.get_string('menu-configuration'));

    for (let i = 0; i < this._configs.length; i++) {

      // Make sure that all fields of the menu config are initialized to sane defaults.
      ItemRegistry.normalizeConfig(this._configs[i]);

      // If, for some reason, no ID is assigned to a menu, generate a new one.
      if (this._configs[i].id == undefined) {
        this._configs[i].id = this._getNewID();
      }
    }
  }

  _redraw() {

    // If nothing is selected, we draw a grid of all configured menus. A add-new-menu
    // button is appended to the end of the grid. This grid could be realized with a
    // GtkGrid as well, but we want to transition the button positions, so we create
    // something similar with a GtkFixed.
    if (this._selectionChain.length == 0) {

      let items = [];

      for (let i = 0; i < this._configs.length; i++) {
        items.push(this._configs[i].name);
      }
      this._editor.setItems(items);

    } else {
    }

    this._redrawBreadCrumbs();
  }

  // This updates the bread crumbs at the top of the menu editor. They show the current
  // selection chain and allow for navigating to parent levels.
  _redrawBreadCrumbs() {

    // Translators: The top-most item of the menu editor bread crumbs which is always
    // visible.
    let label = _('All Menus');

    // Make it clickable if it's not the last item.
    if (this._selectionChain.length > 0) {
      label = '<a href="0">' + label + '</a>';
    }

    for (let i = 0; i < this._selectionChain.length; i++) {
      const item = this._getSelected(i);

      // Make it only clickable if it's not the last item.
      if (i + 1 < this._selectionChain.length) {
        label += ` » <a href="${i + 1}">` + item.name + '</a>';
      } else {
        label += ' » ' + item.name;
      }
    }

    this._breadCrumbs.label = label;
  }

  // Returns the item configuration of this._configs according to this._selectionChain. It
  // will return null if either no menu is currently selected or an invalid selection
  // chain is detected.
  // If chainIndex >= 0 is given, the item at the given position in the selection chain is
  // returned, rather than the last item of the chain.
  _getSelected(chainIndex = inf) {
    let item = null;

    // If something is selected, we first determine which menu is selected based on
    // this._selectionChain[0].
    if (this._selectionChain.length > 0) {
      if (this._configs.length > this._selectionChain[0]) {
        item = this._configs[this._selectionChain[0]]
      }
    }

    // Now traverse the selection chain from start to end. If an out-of-range index
    // occurs, we return null. This shouldn't happen...
    for (let i = 1; i < this._selectionChain.length && i <= chainIndex; i++) {
      if (item.children.length > this._selectionChain[i]) {
        item = item.children[this._selectionChain[i]];
      } else {
        return null;
      }
    }

    return item;
  }

  // // This adds a new menu item to the currently selected menu. Items will always be
  // // inserted as a sibling following the currently selected item. This is except for
  // // action items added to top-level menus, here we add them as a child.
  // _addNewItem(newType) {

  //   const [ok, model, selected] = this._selection.get_selected();
  //   let iter;

  //   if (ok) {
  //     if (this._isToplevelSelected() &&
  //         ItemRegistry.getItemTypes()[newType].class == ItemClass.ACTION) {
  //       iter = this._store.append(selected);
  //     } else {
  //       iter = this._store.insert_after(null, selected);
  //     }
  //   }
  //   // If nothing is selected, this will only be called for items of the menu class. We
  //   // add them to the end.
  //   else {
  //     iter = this._store.append(null);
  //   }

  //   // New Menus will get a random emoji icon. All other items will get a name
  //   // and icon according to the item registry.
  //   if (newType == 'CustomMenu') {
  //     this._set(iter, 'ICON', this._getRandomEmoji());
  //   } else {
  //     this._set(iter, 'ICON', ItemRegistry.getItemTypes()[newType].icon);
  //   }

  //   // Assign a new ID for top-level items.
  //   if (this._isToplevelSelected()) {
  //     this._set(iter, 'ID', this._getNewID());
  //   } else {
  //     this._set(iter, 'ID', -1);
  //   }

  //   // Initialize other field to their default values.
  //   this._set(iter, 'TYPE', newType);
  //   this._set(iter, 'NAME', ItemRegistry.getItemTypes()[newType].name);
  //   this._set(iter, 'ANGLE', -1);
  //   this._set(iter, 'SHORTCUT', '');

  //   if (ItemRegistry.getItemTypes()[newType].config != undefined) {
  //     this._set(
  //         iter, 'DATA',
  //         JSON.stringify(ItemRegistry.getItemTypes()[newType].config.defaultData));
  //   }

  //   // Store this in our statistics.
  //   Statistics.getInstance().addItemCreated();
  // }


  // // This asks the user whether she really wants to delete the currently selected item.
  // If
  // // so, it is actually deleted, else nothing is done.
  // _deleteSelected() {
  //   // Nothing to be done if nothing is selected.
  //   if (!this._selection.get_selected()[0]) {
  //     return;
  //   }

  //   // Create the question dialog.
  //   const dialog = new Gtk.MessageDialog({
  //     transient_for: this._builder.get_object('main-notebook').get_root(),
  //     modal: true,
  //     buttons: Gtk.ButtonsType.OK_CANCEL,
  //     message_type: Gtk.MessageType.QUESTION,
  //     text: _('Delete the selected item?'),
  //     secondary_text: _('This cannot be undone!')
  //   });

  //   // Delete the item on a positive response.
  //   dialog.connect('response', (dialog, id) => {
  //     if (id == Gtk.ResponseType.OK) {
  //       const [ok, model, iter] = this._selection.get_selected();
  //       if (ok) {
  //         model.remove(iter);

  //         // Save the menu configuration.
  //         this._saveMenuConfiguration();

  //         // If this was the last menu item, store this in our statistics.
  //         if (!model.get_iter_first()[0]) {
  //           Statistics.getInstance().addDeletedAllMenus();
  //         }
  //       }
  //     }
  //     dialog.destroy();
  //   });

  //   dialog.show();
  // }


  // // Sets the column data of the row identified by iter. The column should be the name
  // // of the column - that is for example "ICON", "ANGLE", or "TYPE". This function will
  // // automatically set the values of "DISPLAY_ICON", "DISPLAY_ANGLE", and
  // "DISPLAY_NAME"
  // // when "ICON", "ANGLE", "NAME", or "DATA" are set. Furthermore, it will
  // automatically
  // // save a JSON representation of the entire menu store to the "menu-configuration"
  // // Gio.Settings key of this application.
  // _set(iter, column, data) {

  //   const isDataColumn =
  //       column != 'DISPLAY_ICON' && column != 'DISPLAY_ANGLE' && column !=
  //       'DISPLAY_NAME';

  //   // First, store the given value.
  //   this._store.set_value(iter, this._store.columns[column], data);

  //   // If the icon, was set, update the "DISPLAY_ICON" as well.
  //   if (column == 'ICON') {
  //     let iconSize = this._isToplevel(iter) ? 24 : 16;
  //     const font   = this._settings.get_string('font');
  //     const color  = this._view.get_style_context().get_color();
  //     this._set(
  //         iter, 'DISPLAY_ICON',
  //         Gdk.pixbuf_get_from_surface(
  //             utils.createIcon(data, iconSize, font, color), 0, 0, iconSize,
  //             iconSize));
  //   }

  //   // If the angle, was set, update the "DISPLAY_ANGLE" as well. For top-level menus,
  //   // this field contains the menu ID, so we update the DISPLAY_ANGLE only for
  //   // non-top-level menus.
  //   if (column == 'ANGLE') {
  //     if (!this._isToplevel(iter)) {
  //       this._set(iter, 'DISPLAY_ANGLE', data >= 0 ? data : '');
  //     }
  //   }

  //   // If the name, was set, update the "DISPLAY_NAME" as well. If iter refers to a
  //   // top-level menu, the display name contains the shortcut.
  //   if (column == 'NAME') {
  //     if (this._isToplevel(iter)) {
  //       let shortcut      = _('Not bound.');
  //       const accelerator = this._get(iter, 'SHORTCUT');
  //       if (accelerator) {
  //         const [ok, keyval, mods] = Gtk.accelerator_parse(accelerator);
  //         shortcut                 = Gtk.accelerator_get_label(keyval, mods);
  //       }
  //       this._set(
  //           iter, 'DISPLAY_NAME',
  //           '<b>' + GLib.markup_escape_text(data, -1) + '</b>\n<small>' +
  //               GLib.markup_escape_text(shortcut, -1) + '</small>');
  //     } else {
  //       this._set(iter, 'DISPLAY_NAME', GLib.markup_escape_text(data, -1));
  //     }
  //   }

  //   // If the data column was set on a top-level menu, we need to update the
  //   // "DISPLAY_NAME" as well, as the shortcut is displayed in the cellrenderer.
  //   if (column == 'SHORTCUT') {
  //     if (this._isToplevel(iter)) {
  //       let shortcut = _('Not bound.');
  //       if (data != '') {
  //         const [ok, keyval, mods] = Gtk.accelerator_parse(data);
  //         shortcut                 = Gtk.accelerator_get_label(keyval, mods);
  //       }
  //       const name = this._get(iter, 'NAME');
  //       this._set(
  //           iter, 'DISPLAY_NAME',
  //           '<b>' + GLib.markup_escape_text(name, -1) + '</b>\n<small>' +
  //               GLib.markup_escape_text(shortcut, -1) + '</small>');
  //     }
  //   }

  //   // If loading has finished, any modifications to the tree store are directly
  //   committed
  //   // to the "menu-configuration" settings key.
  //   if (isDataColumn && this._menuSavingAllowed) {
  //     this._saveMenuConfiguration();
  //   }
  // }


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

      for (let i = 0; i < this._configs.length; i++) {
        if (this._configs[i].id != undefined && this._configs[i].id == newID) {
          isInUse = true;
          break;
        }
      }

    } while (isInUse);

    return newID;
  }

  // // This stores a JSON representation of the entire menu store in the
  // // "menu-configuration" key of the application settings. This is called whenever
  // // something is changed in the menu store. It does not update the settings
  // // instantaneously, it rather waits a few milliseconds for any additional changes.
  // _saveMenuConfiguration() {

  //   // The configuration changed again. Cancel any pending save tasks...
  //   if (this._saveSettingsTimeout != null) {
  //     GLib.source_remove(this._saveSettingsTimeout);
  //     this._saveSettingsTimeout = null;
  //   }

  //   // ... and launch a new one.
  //   this._saveSettingsTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 10, () => {
  //     this._saveSettingsTimeout = null;

  //     // This is called recursively.
  //     const addChildren = (parent, parentIter) => {
  //       // Recursively add all children.
  //       const count = this._store.iter_n_children(parentIter);

  //       if (count > 0) {
  //         parent.children = [];
  //       }

  //       for (let i = 0; i < count; ++i) {
  //         const iter = this._store.iter_nth_child(parentIter, i)[1];
  //         let item   = {
  //           name: this._get(iter, 'NAME'),
  //           icon: this._get(iter, 'ICON'),
  //           type: this._get(iter, 'TYPE'),
  //           data: JSON.parse(this._get(iter, 'DATA')),
  //           angle: this._get(iter, 'ANGLE')
  //         };

  //         parent.children.push(item);

  //         addChildren(item, iter);
  //       }
  //     };

  //     // The top level JSON element is an array containing all menus.
  //     let menus      = [];
  //     let [ok, iter] = this._store.get_iter_first();

  //     while (ok) {
  //       let menu = {
  //         name: this._get(iter, 'NAME'),
  //         icon: this._get(iter, 'ICON'),
  //         type: this._get(iter, 'TYPE'),
  //         data: JSON.parse(this._get(iter, 'DATA')),
  //         shortcut: this._get(iter, 'SHORTCUT'),
  //         id: this._get(iter, 'ID'),
  //         centered: this._get(iter, 'CENTERED'),
  //       };

  //       menus.push(menu);
  //       addChildren(menu, iter);

  //       ok = this._store.iter_next(iter);
  //     }

  //     // Save the configuration as JSON!
  //     this._settings.set_string('menu-configuration', JSON.stringify(menus));

  //     return false;
  //   });
  // }
}
