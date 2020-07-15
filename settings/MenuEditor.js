//////////////////////////////////////////////////////////////////////////////////////////
//   _____       _             _____ _                                                  //
//  |   __|_ _ _|_|___ ___ ___|  _  |_|___   This software may be modified and distri-  //
//  |__   | | | | |   | . |___|   __| | -_|  buted under the terms of the MIT license.  //
//  |_____|_____|_|_|_|_  |   |__|  |_|___|  See the LICENSE file for details.          //
//                    |___|                                                             //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Cairo                          = imports.cairo;
const {GObject, Gdk, GLib, Gtk, Gio} = imports.gi;

const Me            = imports.misc.extensionUtils.getCurrentExtension();
const utils         = Me.imports.common.utils;
const DBusInterface = Me.imports.common.DBusInterface.DBusInterface;
const ItemRegistry  = Me.imports.common.ItemRegistry;

const DBusWrapper = Gio.DBusProxy.makeProxyWrapper(DBusInterface.description);

// These are the different columns of the MenuTreeStore. It contains basically all data of
// all configured menus.
// clang-format off
let ColumnTypes = {
  DISPLAY_ICON:  Cairo.Surface.$gtype,  // The actual Cairo.Surface of the icon.
  DISPLAY_NAME:  GObject.TYPE_STRING,   // The item / menu name as shown (with markup).
  DISPLAY_ANGLE: GObject.TYPE_STRING,   // Empty if angle is -1
  ICON:          GObject.TYPE_STRING,   // The string representation of the icon.
  NAME:          GObject.TYPE_STRING,   // The name without any markup.
  TYPE:          GObject.TYPE_STRING,   // The item type. Like 'Menu' or 'Bookmarks'.
  DATA:          GObject.TYPE_STRING,   // Used for the command, file, application, ...
  ANGLE:         GObject.TYPE_DOUBLE    // The fixed angle.
}
// clang-format on

//////////////////////////////////////////////////////////////////////////////////////////
// The MenuTreeStore differs from a normal Gtk.TreeStore only in the drag'n'drop        //
// behavior. It ensures that top-level menus cannot be dragged at all and the all       //
// other items or submenus are only dropped to top-level menus or to submenus.          //
// Furthermore, it ensure that fixed angles of items which are dragged around are       //
// removed.                                                                             //
// Additionally, it has a public property "columns", which contain the IDs of all the   //
// columns above. For example, this can be used like this:                              //
// this.get_value(iter, this.columns.DISPLAY_NAME);                                     //
//////////////////////////////////////////////////////////////////////////////////////////

let MenuTreeStore = GObject.registerClass({}, class MenuTreeStore extends Gtk.TreeStore {
  _init() {
    super._init();

    // This array is used further down to initialize the column types of this.
    let columnTypes = [];

    // This public property will contain the column IDs for each ColumnType. For example,
    // this can be used like this: this.get_value(iter, this.columns.DISPLAY_NAME);
    this.columns = {};

    let lastColumnID = -1;
    for (const name in ColumnTypes) {
      columnTypes.push(ColumnTypes[name]);
      this.columns[name] = ++lastColumnID;
    }

    // Initialize the column types.
    this.set_column_types(columnTypes);
  }

  // This makes sure that we cannot drag top-level menus. All other items or submenus can
  // be dragged around.
  vfunc_row_draggable(path) {
    return path.get_depth() > 1;
  }

  // This ensures that items or submenus are only dropped on top-level menus or
  // submenus.
  vfunc_row_drop_possible(path) {
    const parentPath = path.copy();
    if (parentPath.up()) {
      const [ok, parent] = this.get_iter(parentPath);
      if (ok) {
        const type = this.get_value(parent, this.columns.TYPE);
        if (type === 'Submenu' || type === 'Menu') {
          return true;
        }
      }
    }
    return false;
  }

  // This resets any fixed angle of dragged items. While this isn't really necessary in
  // all cases, but identifying cases when an invalid fixed-angle configuration is created
  // is quite complex. This could be improved in the future!
  vfunc_drag_data_get(path, selection_data) {
    const [ok, iter] = this.get_iter(path);
    if (ok) {
      this.set_value(iter, this.columns.ANGLE, -1);
      this.set_value(iter, this.columns.DISPLAY_ANGLE, '');
    }
    return super.vfunc_drag_data_get(path, selection_data);
  }
});

//////////////////////////////////////////////////////////////////////////////////////////
// The MenuEditor class encapsulates code required for the 'Menu Editor' page of the    //
// settings dialog. It's not instantiated multiple times, nor does it have any public   //
// interface, hence it could just be copy-pasted to the settings class. But as it's     //
// quite decoupled as well, it structures the code better when written to its own file. //
// I use quite many try / catch blocks which show a notification if an error occurs.    //
// This helps debugging significantly as the errors are otherwise not easy to find      //
// (journalctl /usr/bin/gnome-shell does not contain them).                             //
//////////////////////////////////////////////////////////////////////////////////////////

var MenuEditor = class MenuEditor {

  // ------------------------------------------------------------ constructor / destructor

  constructor(builder) {

    // Keep a reference to the builder.
    this._builder = builder;

    // Create the Gio.Settings object.
    this._settings = utils.createSettings();

    // Connect to the server so that we can toggle menu previews from the menu editor.
    new DBusWrapper(
        Gio.DBus.session, 'org.gnome.Shell', '/org/gnome/shell/extensions/swingpie',
        proxy => this._dbus = proxy);

    // First, we initialize the add-new-item popover and the related buttons.
    try {
      // Here we add one entry to the add-new-item popover for each registered item type.
      for (const type in ItemRegistry.ItemTypes) {
        const row  = new Gtk.ListBoxRow({selectable: false});
        const grid = new Gtk.Grid({
          column_spacing: 8,
          margin_top: 4,
          margin_bottom: 4,
          margin_start: 4,
          margin_end: 10
        });
        const icon =
            new Gtk.Image({icon_name: ItemRegistry.ItemTypes[type].icon, icon_size: 24});
        const name = new Gtk.Label({label: ItemRegistry.ItemTypes[type].name, xalign: 0});
        const description = new Gtk.Label({
          label: '<small>' + ItemRegistry.ItemTypes[type].description + '</small>',
          use_markup: true,
          xalign: 0
        });
        description.get_style_context().add_class('dim-label');

        grid.attach(icon, 0, 0, 1, 2);
        grid.attach(name, 1, 0, 1, 1);
        grid.attach(description, 1, 1, 1, 1);

        row.add(grid);
        row.show_all();

        // The name is important - this is later used to identify the type of the
        // item which is to be created.
        row.set_name(type);

        // Add the new row to the list defined in the ItemRegistry.
        const list = this._builder.get_object(ItemRegistry.ItemTypes[type].settingsList);
        list.insert(row, -1);
      }

      // Add a new item when one entry of the menu-types list it activated.
      this._builder.get_object('menu-types-list')
          .connect('row-activated', (widget, row) => {
            this._addNewItem(row.get_name());
            this._builder.get_object('item-type-popover').popdown();
          });

      // Add a new item when one entry of the action-types list it activated.
      this._builder.get_object('action-types-list')
          .connect('row-activated', (widget, row) => {
            this._addNewItem(row.get_name());
            this._builder.get_object('item-type-popover').popdown();
          });

      // Add a new item when one entry of the submenu-types list it activated.
      this._builder.get_object('submenu-types-list')
          .connect('row-activated', (widget, row) => {
            this._addNewItem(row.get_name());
            this._builder.get_object('item-type-popover').popdown();
          });

      // Delete the selected item when the item-delete button is clicked.
      this._builder.get_object('remove-item-button').connect('clicked', () => {
        this._deleteSelected();
      });

    } catch (error) {
      utils.notification('Failed to initialize Menu Editor\'s Item Types: ' + error);
    }


    // Now create the menu tree store and tree view. The tree store contains several
    // columns which basically contain all the information required to create all menus.
    // The tree view has two columns, the first shows an icon and the item's name; the
    // second shows the item's fixed angle.
    try {
      // Create our custom tree store and assign it to the tree view of the builder.
      this._store     = new MenuTreeStore();
      this._selection = this._builder.get_object('menus-treeview-selection');
      const view      = this._builder.get_object('menus-treeview');
      view.set_model(this._store);

      // Delete the selected item when the Delete key is pressed.
      view.connect('key-release-event', (widget, event) => {
        if (event.get_keyval()[1] == Gdk.KEY_Delete) {
          this._deleteSelected();
          return true;
        }
        return false;
      });

      // When a new row is inserted or an existing row is dragged around, we make sure
      // that it stays selected. Additionally we save the menu configuration.
      this._store.connect('row-inserted', (widget, path, iter) => {
        // This is kind of a weird hack (?) to keep a row selected after drag'n'drop. We
        // simply select every row after it was inserted. This does not work if we
        // directly attempt to select it, we have to use a short timeout.
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1, () => {
          this._selection.select_iter(iter);

          // Save the menu configuration.
          this._saveMenuConfiguration();

          return false;
        });
      });

      // The tree view's main column contains an icon and some text. The icon is given in
      // the DISPLAY_ICON column of the menu store; the text is contained in the
      // DISPLAY_NAME column.
      const menuColumn = new Gtk.TreeViewColumn({
        title: 'Menu Structure',
        expand: true,
        sizing: Gtk.TreeViewColumnSizing.AUTOSIZE
      });
      const iconRender = new Gtk.CellRendererPixbuf();
      const nameRender = new Gtk.CellRendererText({xpad: 5});
      menuColumn.pack_start(iconRender, false);
      menuColumn.pack_start(nameRender, true);
      menuColumn.add_attribute(iconRender, 'surface', this._store.columns.DISPLAY_ICON);
      menuColumn.add_attribute(nameRender, 'markup', this._store.columns.DISPLAY_NAME);
      view.append_column(menuColumn);

      // The secondary tree view column shows the item's fixed angle, if any. The
      // displayed fixed angle is contained in the menu store's DISPLAY_ANGLE column.
      const angleColumn = new Gtk.TreeViewColumn(
          {title: 'Fixed Angle', sizing: Gtk.TreeViewColumnSizing.AUTOSIZE});
      const angleRender = new Gtk.CellRendererText({sensitive: false, xalign: 0.5});
      angleColumn.pack_start(angleRender, true);
      angleColumn.add_attribute(angleRender, 'markup', this._store.columns.DISPLAY_ANGLE);
      view.append_column(angleColumn);

    } catch (error) {
      utils.notification('Failed to initialize Menu Editor columns: ' + error);
    }

    // Now that the tree store is set up, we can load the entire menu configuration.
    this._loadMenuConfiguration();

    // Now we initialize all icon-related UI elements. That is first and foremost the
    // icon-select popover.
    try {

      // Icons are loaded asynchronously. Once this is finished, the little spinner in the
      // top right of the popover is hidden.
      this._loadIcons().then(() => {
        this._builder.get_object('icon-load-spinner').active = false;
      });

      // Filter the icon view based on the content of the search field.
      const iconListFiltered = this._builder.get_object('icon-list-filtered');
      const filterEntry      = this._builder.get_object('icon-filter-entry');
      iconListFiltered.set_visible_func((model, iter) => {
        const name = model.get_value(iter, 0);
        if (name == null) {
          return false;
        }
        return name.toLowerCase().includes(filterEntry.text.toLowerCase());
      });

      // Refilter the icon list whenever the user types something in the search field.
      filterEntry.connect('notify::text', () => {
        iconListFiltered.refilter();
      });

      // Hide the popover when an icon is activated.
      const iconView = this._builder.get_object('icon-view');
      iconView.connect('item-activated', () => {
        this._builder.get_object('icon-popover').popdown();
      });

      // Set the text of the icon name input field when an icon is selected.
      iconView.connect('selection-changed', (view) => {
        const path       = view.get_selected_items()[0];
        const model      = view.get_model();
        const [ok, iter] = model.get_iter(path);
        if (ok) {
          this._builder.get_object('icon-name').text = model.get_value(iter, 0);
        }
      });

      // Hide the popover when a file of the select-a-custom-icon dialog is activated.
      const iconChooser = this._builder.get_object('icon-file-chooser');
      iconChooser.connect('file-activated', (chooser) => {
        this._builder.get_object('icon-popover').popdown();
      });

      // Set the text of the icon name input field when a file of the select-a-custom-icon
      // dialog is selected.
      iconChooser.connect('selection-changed', (chooser) => {
        this._builder.get_object('icon-name').text = chooser.get_filename();
      });

      // Draw an icon to the drawing area whenever it's invalidated. This happens usually
      // when the text of the icon name input field changes.
      this._builder.get_object('item-icon-drawingarea').connect('draw', (widget, ctx) => {
        const size =
            Math.min(widget.get_allocated_width(), widget.get_allocated_height());
        const icon = this._getSelected('ICON');
        utils.paintIcon(ctx, icon, size, 1);
        return false;
      });

      // Redraw the icon when the icon name input field is changed. Also, store the new
      // icon name in the tree store. This will lead to a re-draw of the icon in the tree
      // view as well.
      this._builder.get_object('icon-name').connect('notify::text', (widget) => {
        this._setSelected('ICON', widget.text);
        this._builder.get_object('item-icon-drawingarea').queue_draw();
      });

    } catch (error) {
      utils.notification('Failed to initialize Menu Editor\'s icon popover: ' + error);
    }


    // Now we initialize all other widgets of the item settings. That is, for example, the
    // name, the url, command, or file input fields.
    try {

      // Store the item's name in the tree store when the text of the input field is
      // changed.
      this._builder.get_object('item-name').connect('notify::text', (widget) => {
        this._setSelected('NAME', widget.text);
      });

      // Store the item's URL in the tree store's DATA column when the text of the
      // corresponding input field is changed.
      this._builder.get_object('item-url').connect('notify::text', (widget) => {
        this._setSelected('DATA', widget.text);
      });

      // Store the item's file path in the tree store's DATA column when the text of the
      // corresponding input field is changed.
      this._builder.get_object('item-file').connect('notify::text', (widget) => {
        this._setSelected('DATA', widget.text);
      });

      // Store the item's command in the tree store's DATA column when the text of the
      // corresponding input field is changed.
      this._builder.get_object('item-command').connect('notify::text', (widget) => {
        this._setSelected('DATA', widget.text);
      });

      // Store the item's maximum item count in the tree store's DATA column when the
      // corresponding input field is changed.
      this._builder.get_object('item-count').connect('value-changed', (adjustment) => {
        this._setSelected('DATA', adjustment.value);
      });

      // Store the item's fixed angle in the tree store's ANGLE column when the
      // corresponding input field is changed. This is a bit more involved, as we check
      // for monotonically increasing angles among all sibling items. We iterate through
      // all children of the selected item's parent (that means all siblings of the
      // selected item). The minAngle is set to the largest fixed angle amongst all
      // siblings preceding the selected item; maxAngle is set to the smallest fixed angle
      // amongst siblings after the selected item.
      this._builder.get_object('item-angle').connect('value-changed', (adjustment) => {
        let minAngle = -1
        let maxAngle = 360

        const [ok1, model, selectedIter] = this._selection.get_selected();
        if (!ok1) return;

        const [ok2, parentIter] = model.iter_parent(selectedIter);
        if (!ok2) return;

        const selectedIndices = model.get_path(selectedIter).get_indices();
        const selectedIndex   = selectedIndices[selectedIndices.length - 1];
        const nChildren       = model.iter_n_children(parentIter);

        for (let n = 0; n < nChildren; n++) {
          const angle = this._get(model.iter_nth_child(parentIter, n)[1], 'ANGLE');

          if (n < selectedIndex) {
            minAngle = angle;
          }

          if (n > selectedIndex && angle >= 0) {
            maxAngle = angle;
            break;
          }
        }

        // Set the value of the tree store only if the constraints are fulfilled.
        if (adjustment.value == -1 ||
            (adjustment.value > minAngle && adjustment.value < maxAngle)) {
          this._setSelected('ANGLE', adjustment.value);
        }
      });


      // Initialize the file-select-popover. When a file is activated, the popover is
      // hidden, when a file is selected, the item's name, icon and file input fields are
      // updated accordingly.
      this._builder.get_object('item-file-chooser').connect('file-activated', () => {
        this._builder.get_object('item-file-popover').popdown();
      });

      this._builder.get_object('item-file-chooser')
          .connect('selection-changed', (widget) => {
            const info = widget.get_file().query_info('standard::icon', 0, null);
            this._builder.get_object('icon-name').text = info.get_icon().to_string();
            this._builder.get_object('item-name').text = widget.get_file().get_basename();
            this._builder.get_object('item-file').text = widget.get_filename();
          });

      // Initialize the application-select-popover. When an application is activated, the
      // popover is hidden, when an application is selected, the item's name, icon and
      // command input fields are updated accordingly.
      this._builder.get_object('application-popover-list')
          .connect('application-activated', () => {
            this._builder.get_object('item-application-popover').popdown();
          });

      this._builder.get_object('application-popover-list')
          .connect('application-selected', (widget, app) => {
            this._builder.get_object('icon-name').text    = app.get_icon().to_string();
            this._builder.get_object('item-name').text    = app.get_display_name();
            this._builder.get_object('item-command').text = app.get_commandline();
          });

      // Initialize the two hotkey-select elements. See the documentation of
      // _initHotkeySelect for details.
      this._itemHotkeyLabel = this._initHotkeySelect('item-hotkey-select', true);
      this._menuHotkeyLabel = this._initHotkeySelect('menu-hotkey-select', false);

    } catch (error) {
      utils.notification('Failed to initialize Menu Editor\'s item settings: ' + error);
    }


    // When the currently selected menu item changes, the content of the settings widgets
    // must be updated accordingly.
    this._selection.connect('changed', (selection) => {
      try {

        // Some widgets are disabled if nothing is selected.
        let somethingSelected = selection.get_selected()[0];
        this._builder.get_object('preview-menu-button').sensitive = somethingSelected;
        this._builder.get_object('remove-item-button').sensitive  = somethingSelected;
        this._builder.get_object('action-types-list').sensitive   = somethingSelected;
        this._builder.get_object('submenu-types-list').sensitive  = somethingSelected;

        // There are multiple Gtk.Revealers involved. Based on the selected item's type
        // their content is either shown or hidden. First we assume that all are hidden
        // and selectively set them to be shown.
        const revealers = {
          'item-settings-revealer': somethingSelected,
          'item-settings-menu-hotkey-revealer': false,
          'item-settings-angle-revealer': false,
          'item-settings-item-hotkey-revealer': false,
          'item-settings-count-revealer': false,
          'item-settings-url-revealer': false,
          'item-settings-command-revealer': false,
          'item-settings-file-revealer': false
        };

        if (somethingSelected) {

          // The item's name and the item's icon name have to be updated in any case if
          // something is selected.
          this._builder.get_object('icon-name').text = this._getSelected('ICON');
          this._builder.get_object('item-name').text = this._getSelected('NAME');

          const selectedType         = this._getSelected('TYPE');
          const selectedSettingsType = ItemRegistry.ItemTypes[selectedType].settingsType;

          // If the selected item is a top-level menu, the DATA column contains its
          // hotkey.
          if (selectedSettingsType == ItemRegistry.SettingsTypes.MENU) {
            this._menuHotkeyLabel.set_accelerator(this._getSelected('DATA'));
            revealers['item-settings-menu-hotkey-revealer'] = true;
          }

          // For all other items, the fixed angle can be set.
          if (selectedSettingsType != ItemRegistry.SettingsTypes.MENU) {
            this._builder.get_object('item-angle').value = this._getSelected('ANGLE');
            revealers['item-settings-angle-revealer']    = true;
          }

          if (selectedSettingsType == ItemRegistry.SettingsTypes.HOTKEY) {
            this._itemHotkeyLabel.set_accelerator(this._getSelected('DATA'));
            revealers['item-settings-item-hotkey-revealer'] = true;

          } else if (selectedSettingsType == ItemRegistry.SettingsTypes.URL) {
            this._builder.get_object('item-url').text = this._getSelected('DATA');
            revealers['item-settings-url-revealer']   = true;

          } else if (selectedSettingsType == ItemRegistry.SettingsTypes.FILE) {
            this._builder.get_object('item-file').text = this._getSelected('DATA');
            revealers['item-settings-file-revealer']   = true;

          } else if (selectedSettingsType == ItemRegistry.SettingsTypes.COMMAND) {
            this._builder.get_object('item-command').text = this._getSelected('DATA');
            revealers['item-settings-command-revealer']   = true;

          } else if (selectedSettingsType == ItemRegistry.SettingsTypes.COUNT) {
            this._builder.get_object('item-count').value = this._getSelected('DATA');
            revealers['item-settings-count-revealer']    = true;
          }
        }

        // Finally update the state of all revealers.
        for (const revealer in revealers) {
          this._builder.get_object(revealer).reveal_child = revealers[revealer];
        }

      } catch (error) {
        utils.notification('Failed to update menu editor selection: ' + error);
      }
    });
  }

  // ----------------------------------------------------------------------- private stuff

  // This loads all icons of the current icon theme to the icon list of the
  // icon-select-popover. As this takes some time, it is done asynchronously. We do not
  // check for icon theme changes for now - this could be improved in the future!
  async _loadIcons() {
    const iconList = this._builder.get_object('icon-list');

    // Disable sorting for now. Else this is horribly slow...
    iconList.set_sort_column_id(-2, Gtk.SortType.ASCENDING);

    const iconTheme = Gtk.IconTheme.get_default();
    const icons     = iconTheme.list_icons(null);

    // We add icons in batches. This number is somewhat arbitrary - if reduced to 1, the
    // icon loading takes quite long, if increased further the user interface gets a bit
    // laggy during icon loading. Ten seems to be a good compromise...
    const batchSize = 10;
    for (let i = 0; i < icons.length; i += batchSize) {
      for (let j = 0; j < batchSize && i + j < icons.length; j++) {
        iconList.set_value(iconList.append(null), 0, icons[i + j]);
      }

      // This is effectively a 'yield'. We wait asynchronously for the timeout (1ms) to
      // resolve, letting other events to be processed in the meantime.
      await new Promise(r => GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1, r));
    }

    // Enable sorting again!
    iconList.set_sort_column_id(0, Gtk.SortType.ASCENDING);
  }


  // This creates / initializes a Gtk.ListBoxRow which can be used to select a hotkey. A
  // Gtk.ShortcutLabel is used to visualize the hotkey - this element is not yet available
  // in Glade, therefore it's created here in code. This makes everything a bit
  // hard-wired, which could be improved in the future.
  // The functionality is added to a Gtk.ListBoxRow identified via rowName. This row is
  // expected to have single Gtk.Box as child; the Gtk.ShortcutLabel will be packed to the
  // end of this Gtk.Box.
  // The doFullGrab parameters enables selection of hotkeys which are already bound to
  // something else. For example, imagine you have configured opening a terminal via
  // Ctrl+Alt+T in your system settings. Now if doFullGrab == false, selecting Ctrl+Alt+T
  // will not work; it will open the terminal instead. However, if doFullGrab == true, you
  // will be able to select Ctrl+Alt+T. This is very important - we do not want to bind
  // menus to hotkeys which are bound to something else - but we want menu items to
  // simulate hotkey presses which are actually bound to something else!
  _initHotkeySelect(rowName, doFullGrab) {

    const row   = this._builder.get_object(rowName);
    const label = new Gtk.ShortcutLabel({disabled_text: 'Not bound.'});
    row.get_child().pack_end(label, false, false, 0);
    label.show();

    // This function grabs the keyboard input. If doFullGrab == true, the complete
    // keyboard input of the default Seat will be grabbed. Else only a Gtk grab is
    // performed. The text of the Gtk.ShortcutLabel is changed to indicate that the widget
    // is waiting for input.
    const grabKeyboard = () => {
      if (doFullGrab) {
        const seat = Gdk.Display.get_default().get_default_seat();
        seat.grab(
            row.get_window(), Gdk.SeatCapabilities.KEYBOARD, false, null, null, null);
      }
      row.grab_add();
      label.set_accelerator('');
      label.set_disabled_text('Press the hotkey! (ESC to cancel, BackSpace to unbind)');
    };

    // This function cancels any previous grab. The label's disabled-text is reset to "Not
    // bound".
    const cancelGrab = () => {
      if (doFullGrab) {
        const seat = Gdk.Display.get_default().get_default_seat();
        seat.ungrab();
      }
      row.grab_remove();
      row.parent.unselect_all();
      label.set_disabled_text('Not bound');
    };

    // When the row is activated, the input is grabbed.
    row.parent.connect('row-activated', (row) => {
      grabKeyboard();
    });

    // Key input events are received once the input is grabbed.
    row.connect('key-press-event', (row, event) => {
      if (row.is_selected()) {
        const keyval = event.get_keyval()[1];
        const mods   = event.get_state()[1] & Gtk.accelerator_get_default_mod_mask();

        if (keyval == Gdk.KEY_Escape) {
          // Escape cancels the hotkey selection.
          label.set_accelerator(this._getSelected('DATA'));
          cancelGrab();

        } else if (keyval == Gdk.KEY_BackSpace) {
          // BackSpace removes any bindings.
          label.set_accelerator('');
          this._setSelected('DATA', '');
          cancelGrab();

        } else if (Gtk.accelerator_valid(keyval, mods)) {
          // Else, if a valid accelerator was pressed, we store it.
          const accelerator = Gtk.accelerator_name(keyval, mods);
          this._setSelected('DATA', accelerator);
          label.set_accelerator(accelerator);
          cancelGrab();
        }

        return true;
      }
      return false;
    });

    // Return the label - this wouldn't be necessary if we could create the
    // Gtk.ShortcutLabel directly in Glade.
    return label;
  }

  // This adds a new menu item to the currently selected menu. If a top-level menu or a
  // submenu is selected, it's inserted as a new last child, if another item is selected,
  // it will be inserted as a sibling following the currently selected item.
  _addNewItem(newType) {
    try {

      // New top-level menus are always append to the end of the tree store. The icon of
      // the new menu is a randomly chosen emoji.
      if (newType == 'Menu') {
        const iter = this._store.append(null);
        this._set(iter, 'ICON', this._getRandomEmoji());
        this._set(iter, 'NAME', 'New Menu');
        this._set(iter, 'TYPE', 'Menu');
        this._set(iter, 'DATA', '');
        this._set(iter, 'ANGLE', -1);
        return;
      }

      // Depending on the selected type, the new item is inserted a different places. If a
      // submenu is selected, it's inserted as a new last child, if another item is
      // selected, it will be inserted as a sibling following the currently selected item.
      const selectedType          = this._getSelected('TYPE');
      const [ok, model, selected] = this._selection.get_selected();
      let iter                    = null;

      if (selectedType == 'Menu' || selectedType == 'Submenu') {
        iter = this._store.append(selected);

      } else {
        const parent = model.iter_parent(selected)[1];
        iter         = this._store.insert_after(parent, selected);
      }

      // New Submenus will also get a random emoji icon. All other items will get a name
      // and icon according to the item registry.
      if (newType == 'Submenu') {
        this._set(iter, 'ICON', this._getRandomEmoji());
        this._set(iter, 'NAME', 'New Submenu');
      } else {
        this._set(iter, 'ICON', ItemRegistry.ItemTypes[newType].icon);
        this._set(iter, 'NAME', ItemRegistry.ItemTypes[newType].name);
      }

      // Initialize other field to their default values.
      this._set(iter, 'TYPE', newType);
      this._set(iter, 'DATA', '');
      this._set(iter, 'ANGLE', -1);

    } catch (error) {
      utils.notification('Failed to add new item: ' + error);
    }
  }


  // This asks the user whether she really wants to delete the currently selected item. If
  // so, it is actually deleted, else nothing is done.
  _deleteSelected() {
    // Nothing to be done if nothing is selected.
    if (!this._selection.get_selected()[0]) {
      return;
    }

    // Create the question dialog.
    const dialog = new Gtk.MessageDialog({
      transient_for: this._builder.get_object('main-notebook').get_toplevel(),
      modal: true,
      buttons: Gtk.ButtonsType.OK_CANCEL,
      message_type: Gtk.MessageType.QUESTION,
      text: 'Do you really want to delete the selected item?',
      secondary_text: 'This cannot be undone!'
    });

    // Delete the item on a positive response.
    dialog.connect('response', (dialog, id) => {
      utils.notification(id + ' ' + Gtk.ResponseType.OK);
      if (id == Gtk.ResponseType.OK) {
        const [ok, model, iter] = this._selection.get_selected();
        if (ok) {
          model.remove(iter);

          // Save the menu configuration.
          this._saveMenuConfiguration();
        }
      }
      dialog.destroy();
    });

    dialog.show();
  }


  // Returns true if iter refers to a top-level menu.
  _isToplevel(iter) {
    return this._store.get_path(iter).get_depth() <= 1;
  }


  // Returns true if a top-level menu is currently selected.
  _isToplevelSelected() {
    const [ok, model, iter] = this._selection.get_selected();
    if (ok) {
      return model.get_path(iter).get_depth() <= 1;
    }
    return false;
  }

  // Returns the column data of the row identified by iter. The column should be the name
  // of the column - that is for example "DISPLAY_NAME", "ANGLE", or "TYPE".
  _get(iter, column) {
    return this._store.get_value(iter, this._store.columns[column]);
  }


  // Sets the column data of the row identified by iter. The column should be the name
  // of the column - that is for example "ICON", "ANGLE", or "TYPE".
  // This function will automatically set the values of "DISPLAY_ICON", "DISPLAY_ANGLE",
  // and "DISPLAY_NAME" when "ICON", "ANGLE", "NAME", or "DATA" are set.
  // Furthermore, it will automatically save a JSON representation of the entire menu
  // store to the "menu-configuration" Gio.Settings key of this application.
  _set(iter, column, data) {
    try {

      // Do not change anything if not changed.
      if (this._get(iter, column) == data) {
        return;
      }

      // First, store the given value.
      this._store.set_value(iter, this._store.columns[column], data);

      // If the icon, was set, update the "DISPLAY_ICON" as well.
      if (column == 'ICON') {
        let iconSize = this._isToplevel(iter) ? 24 : 16;
        this._set(iter, 'DISPLAY_ICON', utils.createIcon(data, iconSize));
      }

      // If the angle, was set, update the "DISPLAY_ANGLE" as well.
      if (column == 'ANGLE') {
        this._set(iter, 'DISPLAY_ANGLE', data >= 0 ? data : '');
      }

      // If the name, was set, update the "DISPLAY_NAME" as well. If iter refers to a
      // top-level menu, the display name contains the hotkey.
      if (column == 'NAME') {
        if (this._isToplevel(iter)) {
          let hotkey        = 'Not bound.';
          const accelerator = this._get(iter, 'DATA');
          if (accelerator) {
            const [keyval, mods] = Gtk.accelerator_parse(accelerator);
            hotkey               = Gtk.accelerator_get_label(keyval, mods);
          }
          this._set(
              iter, 'DISPLAY_NAME', '<b>' + data + '</b>\n<small>' + hotkey + '</small>');
        } else {
          this._set(iter, 'DISPLAY_NAME', data);
        }
      }

      // If the data column was set on a top-level menu, we need to update the
      // "DISPLAY_NAME" as well, as the data column contains the hotkey of the menu.
      if (column == 'DATA') {
        if (this._isToplevel(iter)) {
          let hotkey = 'Not bound.';
          if (data != '') {
            const [keyval, mods] = Gtk.accelerator_parse(data);
            hotkey               = Gtk.accelerator_get_label(keyval, mods);
          }
          const name = this._get(iter, 'NAME');
          this._set(
              iter, 'DISPLAY_NAME', '<b>' + name + '</b>\n<small>' + hotkey + '</small>');
        }
      }
    } catch (error) {
      utils.notification('Failed to change menu configuration: ' + error);
    }

    // If loading has finished, any modifications to the tree store are directly committed
    // to the "menu-configuration" settings key.
    if (this._loadedMenuConfiguration) {
      this._saveMenuConfiguration();
    }
  }


  // This is the same as this._get(), however it automatically chooses the currently
  // selected row.
  _getSelected(column) {
    const [ok, model, iter] = this._selection.get_selected();
    if (ok) {
      return this._get(iter, column);
    }
  }


  // This is the same as this._set(), however it automatically chooses the currently
  // selected row.
  _setSelected(column, data) {
    const [ok, model, iter] = this._selection.get_selected();
    if (ok) {
      this._set(iter, column, data);
    }
  }


  // This is a little helper to make creating new menus more fun. New menus and submenus
  // will get a random emoji as a icon!
  _getRandomEmoji() {
    let emojis = [
      ...'💾🐹💞😀🎂🌞🥇💗🌟🐣🔧🌍🐈🍩💕🦔🤣📝🥂💥😁🎉💖😎😛🐸🍕☕🍺🍰🗿'
    ];

    // The +0 is a little hack - else emojis.length is not recognized as a number?!
    return emojis[Math.floor(Math.random() * (emojis.length + 0))];
  }

  // This stores a JSON representation of the entire menu store in the
  // "menu-configuration" key of the application settings. This is called whenever
  // something is changed in the menu store.
  _saveMenuConfiguration() {

    try {

      // This is called recursively.
      const addItem = (list, iter) => {
        let item = {
          name: this._get(iter, 'NAME'),
          icon: this._get(iter, 'ICON'),
          type: this._get(iter, 'TYPE'),
          data: this._get(iter, 'DATA'),
          angle: this._get(iter, 'ANGLE'),
          children: []
        };

        // Recursively add all children.
        const count = this._store.iter_n_children(iter);
        for (let i = 0; i < count; ++i) {
          const childIter = this._store.iter_nth_child(iter, i)[1];
          addItem(item.children, childIter);
        }

        list.push(item);
      };

      // The top level JSON element is an array containing all menus.
      let menus      = [];
      let [ok, iter] = this._store.get_iter_first();

      while (ok) {
        addItem(menus, iter);
        ok = this._store.iter_next(iter);
      }

      // Save the configuration as JSON!
      this._settings.set_string('menu-configuration', JSON.stringify(menus));

    } catch (error) {
      utils.notification('Failed to save menu configuration: ' + error);
    }
  }


  // This is called once initially and loads the JSON menu configuration from
  // "menu-configuration". It populates the menu store with all configured menus.
  _loadMenuConfiguration() {

    try {

      // This is called recursively.
      const parseItem = (item, iter) => {
        this._set(iter, 'ICON', item.icon);
        this._set(iter, 'NAME', item.name);
        this._set(iter, 'TYPE', item.type);
        this._set(iter, 'DATA', item.data);
        this._set(iter, 'ANGLE', item.angle);

        // Load all children recursively.
        for (let j = 0; j < item.children.length; j++) {
          const child     = item.children[j];
          const childIter = this._store.append(iter);

          parseItem(child, childIter);
        }
      };

      // Load the menu configuration in the JSON format.
      const menus = JSON.parse(this._settings.get_string('menu-configuration'));

      for (let i = 0; i < menus.length; i++) {
        const menu = menus[i];
        const iter = this._store.append(null);

        parseItem(menu, iter);
      }

      // Flag that loading is finished - all next calls to this._set() will update the
      // "menu-configuration".
      this._loadedMenuConfiguration = true;

    } catch (error) {
      utils.notification('Failed to load menu configuration: ' + error);
    }
  }
}