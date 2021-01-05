//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Cairo                          = imports.cairo;
const {GObject, Gdk, GLib, Gtk, Gio} = imports.gi;

const Me            = imports.misc.extensionUtils.getCurrentExtension();
const utils         = Me.imports.src.common.utils;
const DBusInterface = Me.imports.src.common.DBusInterface.DBusInterface;
const Statistics    = Me.imports.src.common.Statistics.Statistics;
const ItemRegistry  = Me.imports.src.common.ItemRegistry.ItemRegistry;
const Enums         = Me.imports.src.common.Enums;

const DBusWrapper = Gio.DBusProxy.makeProxyWrapper(DBusInterface.description);

const _ = imports.gettext.domain('flypie').gettext;

// These are the different columns of the MenuTreeStore. It contains basically all data of
// all configured menus.
// clang-format off
let ColumnTypes = {
  DISPLAY_ICON:  Cairo.Surface.$gtype,  // The actual Cairo.Surface of the icon.
  DISPLAY_NAME:  GObject.TYPE_STRING,   // The item / menu name as shown (with markup).
  DISPLAY_ANGLE: GObject.TYPE_STRING,   // Empty if angle is -1
  ICON:          GObject.TYPE_STRING,   // The string representation of the icon.
  NAME:          GObject.TYPE_STRING,   // The name without any markup.
  TYPE:          GObject.TYPE_STRING,   // The item type. Like 'Shortcut' or 'Bookmarks'.
  DATA:          GObject.TYPE_STRING,   // Used for the command, file, application, ...
  SHORTCUT:      GObject.TYPE_STRING,   // Hotkey to open top-level menus.
  CENTERED:      GObject.TYPE_BOOLEAN,  // Wether a menu should be opened centered.
  ANGLE:         GObject.TYPE_INT,      // The fixed angle for items.
  ID:            GObject.TYPE_INT       // The menu ID for top-level menus.
}
// clang-format on

//////////////////////////////////////////////////////////////////////////////////////////
// The MenuTreeStore differs from a normal Gtk.TreeStore only in the drag'n'drop        //
// behavior. It ensures that actions are only dropped into custom menus and menus only  //
// at top-level or into custom menus.                                                   //
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

  // This ensures that actions are only dropped into custom menus and menus are only
  // dropped at top-level or into custom menus.
  vfunc_row_drop_possible(destPath, data) {

    // Do not attempt to drop into ourselves.
    const [ok, model, srcPath] = Gtk.tree_get_row_drag_data(data);
    if (!ok || srcPath.is_ancestor(destPath)) {
      return false;
    }

    // Allow menu drop at top-level.
    const [ok2, srcIter] = this.get_iter(srcPath);
    const type           = this.get_value(srcIter, this.columns.TYPE);
    const itemClass      = ItemRegistry.getItemTypes()[type].itemClass;

    if (destPath.get_depth() == 1 && itemClass == Enums.ItemClass.MENU) {
      return true;
    }

    // Allow drop in custom menus in all cases.
    const parentPath = destPath.copy();
    if (parentPath.up()) {
      const [ok, parent] = this.get_iter(parentPath);
      if (ok) {
        if (this.get_value(parent, this.columns.TYPE) === 'CustomMenu') {
          return true;
        }
      }
    }

    return false;
  }
});

//////////////////////////////////////////////////////////////////////////////////////////
// The MenuEditor class encapsulates code required for the 'Menu Editor' page of the    //
// settings dialog. It's not instantiated multiple times, nor does it have any public   //
// interface, hence it could just be copy-pasted to the settings class. But as it's     //
// quite decoupled (and huge) as well, it structures the code better when written to    //
// its own file.                                                                        //
//////////////////////////////////////////////////////////////////////////////////////////

var MenuEditor = class MenuEditor {

  // ------------------------------------------------------------ constructor / destructor

  constructor(builder, settings) {

    // Keep a reference to the builder and the settings.
    this._builder  = builder;
    this._settings = settings;

    // Connect to the server so that we can toggle menu previews from the menu editor.
    new DBusWrapper(
        Gio.DBus.session, 'org.gnome.Shell', '/org/gnome/shell/extensions/flypie',
        proxy => this._dbus = proxy);

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

      row.add(grid);
      row.show_all();

      // The name is important - this is later used to identify the type of the
      // item which is to be created.
      row.set_name(type);

      // Add the new row either to the menus list or to the actions list.
      if (ItemRegistry.getItemTypes()[type].itemClass == Enums.ItemClass.ACTION) {
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

    // Delete the selected item when the item-delete button is clicked.
    this._builder.get_object('remove-item-button').connect('clicked', () => {
      this._deleteSelected();
    });

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
          }
        });
      }
    });

    // Open a save-dialog when the export-config button is pressed.
    this._builder.get_object('export-menu-config-button').connect('clicked', (button) => {
      const dialog = new Gtk.FileChooserDialog({
        title: _('Export Menu Configuration'),
        action: Gtk.FileChooserAction.SAVE,
        do_overwrite_confirmation: true,
        transient_for: button.get_toplevel(),
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
            let path = dialog.get_filename();

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
            Statistics.addMenuExport();

          } catch (error) {
            const errorMessage = new Gtk.MessageDialog({
              transient_for: button.get_toplevel(),
              buttons: Gtk.ButtonsType.CLOSE,
              message_type: Gtk.MessageType.ERROR,
              text: _('Failed to export the menu configuration!'),
              secondary_text: '' + error
            });
            errorMessage.run();
            errorMessage.destroy();
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
        transient_for: button.get_toplevel(),
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
            const file                = Gio.File.new_for_path(dialog.get_filename());
            const [success, contents] = file.load_contents(null);

            // Load the configuration! We do a parse / stringify to catch any JSON errors
            // here.
            if (success) {
              const config = JSON.parse(contents);
              this._settings.set_string('menu-configuration', JSON.stringify(config));
              this._loadMenuConfiguration();

              // Store this in our statistics.
              Statistics.addMenuImport();
            }

          } catch (error) {
            const errorMessage = new Gtk.MessageDialog({
              transient_for: button.get_toplevel(),
              buttons: Gtk.ButtonsType.CLOSE,
              message_type: Gtk.MessageType.ERROR,
              text: _('Failed to import menu configuration!'),
              secondary_text: '' + error
            });
            errorMessage.run();
            errorMessage.destroy();
          }
        }

        dialog.destroy();
      });

      dialog.show();
    });

    // Now create the menu tree store and tree view. The tree store contains several
    // columns which basically contain all the information required to create all menus.
    // The tree view has two columns, the first shows an icon and the item's name; the
    // second shows the item's fixed angle.

    // First we create our custom tree store and assign it to the tree view of the
    // builder.
    this._store     = new MenuTreeStore();
    this._selection = this._builder.get_object('menus-treeview-selection');
    const view      = this._builder.get_object('menus-treeview');
    view.set_model(this._store);

    // The tree view's main column contains an icon and some text. The icon is given in
    // the DISPLAY_ICON column of the menu store; the text is contained in the
    // DISPLAY_NAME column.
    const menuColumn = new Gtk.TreeViewColumn({
      title: _('Menu Structure'),
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
        {title: _('Fixed Angle'), sizing: Gtk.TreeViewColumnSizing.AUTOSIZE});
    const angleRender = new Gtk.CellRendererText({sensitive: false, xalign: 0.5});
    angleColumn.pack_start(angleRender, true);
    angleColumn.add_attribute(angleRender, 'markup', this._store.columns.DISPLAY_ANGLE);
    view.append_column(angleColumn);

    // Then we set up drag'n'drop. The tree view is a source of internal drag'n'drop
    // operations. This is because we can reorder the menu items. We use the special
    // 'GTK_TREE_MODEL_ROW' target. This makes sure that most of the row-reordering
    // functionality works out-of-the-box.
    view.enable_model_drag_source(
        Gdk.ModifierType.BUTTON1_MASK,
        [Gtk.TargetEntry.new('GTK_TREE_MODEL_ROW', Gtk.TargetFlags.SAME_WIDGET, 0)],
        Gdk.DragAction.COPY | Gdk.DragAction.MOVE);

    // However it is a destination for both, internal and external drag'n'drop operations.
    // Internal operations occur when the user reorders the rows, external operations
    // occur when something is dragged to the tree view in order to create new items. This
    // can be a file, an URL or some other things.
    view.enable_model_drag_dest(
        [
          Gtk.TargetEntry.new('GTK_TREE_MODEL_ROW', Gtk.TargetFlags.SAME_WIDGET, 0),
          Gtk.TargetEntry.new('text/uri-list', 0, 1),
          Gtk.TargetEntry.new('text/plain', 0, 2)
        ],
        Gdk.DragAction.COPY | Gdk.DragAction.MOVE);

    // This is called when a drag'n'drop operation is received.
    view.connect('drag-data-received', (widget, context, x, y, data, info, time) => {
      // This lambda creates a new menu item for the given text. If the text is an URI to
      // a file, a file action is created. If it's a *.desktop file, a "Launch
      // Application" action is created, an URI action is created for all other URIs. If
      // text is not an URI, an "Insert Text" action is created.
      const addItem = (text) => {
        // Items should only be dropped into custom menus. Depending on the hovered
        // position and item type, there are three different possible positions:
        // 1) Drop into the hovered menu as first child.
        // 2) Insert before the hovered menu at the same level.
        // 3) Insert after the hovered menu at the same level.

        // First try to get the currently hovered item.
        const [ok, path, pos] = widget.get_dest_row_at_pos(x, y);

        if (!ok) {
          return false;
        }

        // Get the type of the currently hovered menu item.
        const destIter = this._store.get_iter(path)[1];
        const type     = this._store.get_value(destIter, this._store.columns.TYPE);

        let newIter;

        // If it's a custom menu, we drop into it if it's a top-level menu or if we should
        // drop into anyways. Else we drop before or after as indicated by the
        // TreeViewDropPosition.
        if (type === 'CustomMenu') {

          if (pos == Gtk.TreeViewDropPosition.INTO_OR_BEFORE ||
              pos == Gtk.TreeViewDropPosition.INTO_OR_AFTER ||
              this._isToplevel(destIter)) {
            // 1) above.
            newIter = this._store.append(destIter);
          } else if (pos == Gtk.TreeViewDropPosition.BEFORE) {
            // 2) above.
            newIter = this._store.insert_before(null, destIter);
          } else {
            // 3) above.
            newIter = this._store.insert_after(null, destIter);
          }

        }
        // If it's not a custom menu, we cannot drop into. So we have to drop before or
        // after. This is impossible at top-level.
        else {

          // Things cannot be dropped at top-level, so this is a impossible drop.
          if (this._isToplevel(destIter)) {
            return false;
          }

          if (pos == Gtk.TreeViewDropPosition.BEFORE ||
              pos == Gtk.TreeViewDropPosition.INTO_OR_BEFORE) {
            // 2) above.
            newIter = this._store.insert_before(null, destIter);
          } else {
            // 3) above.
            newIter = this._store.insert_after(null, destIter);
          }
        }

        // Set default values for newly created items.
        this._set(newIter, 'ANGLE', -1);
        this._set(newIter, 'ID', -1);
        this._set(newIter, 'SHORTCUT', '');

        const uriScheme = GLib.uri_parse_scheme(text);
        let success     = false;

        if (uriScheme != null) {
          // First we check whether the dragged data contains an URI. If it points to
          // a *.desktop file, we create a "Launch Application" item the corresponding
          // application.
          if (uriScheme == 'file') {
            const file = Gio.File.new_for_uri(text);

            if (file.query_exists(null)) {

              if (text.endsWith('.desktop')) {

                const info    = Gio.DesktopAppInfo.new_from_filename(file.get_path());
                const newType = 'Command';

                let icon = ItemRegistry.getItemTypes()[newType].icon;
                if (info.get_icon()) {
                  icon = info.get_icon().to_string();
                }

                if (info != null) {
                  this._set(newIter, 'ICON', icon);
                  this._set(newIter, 'NAME', info.get_display_name());
                  this._set(newIter, 'TYPE', newType);
                  this._set(newIter, 'DATA', info.get_commandline());
                  success = true;
                }
              }

              // If it's an URI to any other local file, we create an "Open File" item.
              if (!success) {
                const newType = 'File';
                const info    = file.query_info('standard::icon', 0, null);

                if (info != null) {
                  this._set(newIter, 'ICON', info.get_icon().to_string());
                  this._set(newIter, 'NAME', file.get_basename());
                  this._set(newIter, 'TYPE', newType);
                  this._set(newIter, 'DATA', text.substring(7));  // Skip the file://

                  success = true;
                }
              }
            }
          }

          if (!success) {

            // For any other URI we create an "Open URI" item.
            const newType = 'Uri';
            const name    = text.length < 20 ? text : text.substring(0, 20) + '...';

            this._set(newIter, 'ICON', ItemRegistry.getItemTypes()[newType].icon);
            this._set(newIter, 'NAME', name);
            this._set(newIter, 'TYPE', newType);
            this._set(newIter, 'DATA', text);
            success = true;
          }
        }

        // If it's not an URI, we create a "Insert Text" action.
        else {
          const newType = 'InsertText';
          const name    = text.length < 20 ? text : text.substring(0, 20) + '...';

          this._set(newIter, 'ICON', ItemRegistry.getItemTypes()[newType].icon);
          this._set(newIter, 'NAME', 'Insert: ' + name);
          this._set(newIter, 'TYPE', newType);
          this._set(newIter, 'DATA', text);
        }

        return true;
      };

      // The info paramter is a hint to what the dropped data contains. Refer the call to
      // enable_model_drag_dest() above - there the info numbers are given as last
      // parameter to the constructor of the TargetEntries.
      // info == 0: 'GTK_TREE_MODEL_ROW'
      // info == 1: 'text/uri-list'
      // info == 2: 'text/plain'

      // We do not handle the case info == 0, as this is done by the base class. Due to
      // the special "GTK_TREE_MODEL_ROW" target, row reordering works out-of-the-box.

      // We only handle info == 1 and info == 2. These are the cases when the user drags
      // something from outside to the tree view (external drag'n'drop). We try our best
      // to create a menu item for the dragged data.
      let success = true;

      if (info == 1) {
        const uris = data.get_uris();

        if (uris == null) {
          success = false;
        } else {
          uris.forEach(uri => {success &= addItem(uri)});
        }

        // Independent of the selected drag'n'drop action, the drag source shouldn't
        // remove any source data.
        Gtk.drag_finish(context, success, false, time);

      } else if (info == 2) {

        const text = data.get_text();

        if (text == null) {
          success = false;
        } else {
          success &= addItem(text);
        }

        //  Independent of the selected drag'n'drop action, the drag source shouldn't
        //  remove any source data.
        Gtk.drag_finish(context, success, false, time);
      }
    });

    // Delete the selected item when the Delete key is pressed.
    view.connect('key-release-event', (widget, event) => {
      if (event.get_keyval()[1] == Gdk.KEY_Delete) {
        this._deleteSelected();
        return true;
      }
      return false;
    });

    // When a new row is inserted or an existing row is dragged around, we make sure
    // that it stays selected and additionally we save the menu configuration.
    // This is a bit hacky, as sometimes many rows are inserted (for example, when the
    // user drag a menu to somewhere else). To handle this case, we create two
    // timeouts.

    // The first timeout is used to select a newly added row and ignore all additional
    // row-insertions in the next 10 milliseconds.
    this._selectNewRowTimeout = -1;

    this._store.connect('row-inserted', (widget, path, iter) => {
      // We do this only once the saved configuration is fully loaded.
      if (this._menuSavingAllowed) {

        // Only select a row if another hasn't bee selected in the last 10 milliseconds.
        if (this._selectNewRowTimeout == -1) {

          this._selectNewRowTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 10, () => {
            // Expand the parent so that we can actually select the new row.
            let parent = widget.get_path(iter);

            // Expand nested items.
            if (parent.up()) {
              view.expand_to_path(parent);
            }

            // Remove the ID property of items moved from top-level to a submenu and
            // assign new IDs to items which moved from submenu level to top-level.
            if (this._store.get_path(iter).get_depth() == 1) {
              if (this._get(iter, 'ID') < 0) {
                this._set(iter, 'ID', this._getNewID());
              }

            } else {
              this._set(iter, 'ID', -1);
            }

            // This resets any fixed angle of dragged items. While this isn't really
            // necessary in all cases, but identifying cases when an invalid fixed-angle
            // configuration is created is quite complex. This could be improved in the
            // future!
            this._set(iter, 'ANGLE', -1);
            this._selection.select_iter(iter);

            // We refresh the name of dropped rows as they are rendered differently for
            // top-level items and sub-level items.
            this._set(iter, 'NAME', this._get(iter, 'NAME'));

            // Reset the timeout.
            this._selectNewRowTimeout = -1;
            return false;
          });
        }
      }
    });

    // Now that the tree store is set up, we can load the entire menu configuration.
    try {
      this._loadMenuConfiguration();
    } catch (error) {
      utils.debug('Failed to load menu configuration: ' + error);
    }

    // Now we initialize all icon-related UI elements. That is first and foremost the
    // icon-select popover.
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
      const size = Math.min(widget.get_allocated_width(), widget.get_allocated_height());
      const icon = this._getSelected('ICON');
      if (icon && icon.length > 0) {
        utils.paintIcon(ctx, icon, size, 1);
      }
      return false;
    });

    // Redraw the icon when the icon name input field is changed. Also, store the new
    // icon name in the tree store. This will lead to a re-draw of the icon in the tree
    // view as well.
    this._builder.get_object('icon-name').connect('notify::text', (widget) => {
      this._setSelected('ICON', widget.text);
      this._builder.get_object('item-icon-drawingarea').queue_draw();
    });


    // Now we initialize all other widgets of the item settings. That is, for example, the
    // name, the url, command, or file input fields.
    // Store the item's name in the tree store when the text of the input field is
    // changed.
    this._builder.get_object('item-name').connect('notify::text', (widget) => {
      this._setSelected('NAME', widget.text);
    });

    // Store the item's URI in the tree store's DATA column when the text of the
    // corresponding input field is changed.
    this._builder.get_object('item-uri').connect('notify::text', (widget) => {
      this._setSelected('DATA', widget.text);
    });

    // Store the item's ID in the tree store's DATA column when the text of the
    // corresponding input field is changed.
    this._builder.get_object('item-id').connect('notify::text', (widget) => {
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

    // Store the item's text in the tree store's DATA column when the text of the
    // corresponding input field is changed.
    this._builder.get_object('item-text').connect('notify::text', (widget) => {
      this._setSelected('DATA', widget.text);
    });

    // For top-level menus, store whether they should be opened in the center of the
    // screen.
    this._builder.get_object('menu-centered').connect('notify::active', (widget) => {
      this._setSelected('CENTERED', widget.active);
    });

    // Store the item's fixed angle in the tree store's ANGLE column when the
    // corresponding input field is changed. This is a bit more involved, as we check
    // for monotonically increasing angles among all sibling items. We iterate through
    // all children of the selected item's parent (that means all siblings of the
    // selected item). The minAngle is set to the largest fixed angle amongst all
    // siblings preceding the selected item; maxAngle is set to the smallest fixed angle
    // amongst siblings after the selected item.
    this._builder.get_object('item-angle').connect('value-changed', (adjustment) => {
      let minAngle = -1;
      let maxAngle = 360;

      const [ok1, model, selectedIter] = this._selection.get_selected();
      if (!ok1) return;

      const [ok2, parentIter] = model.iter_parent(selectedIter);
      if (!ok2) return;

      const selectedIndices = model.get_path(selectedIter).get_indices();
      const selectedIndex   = selectedIndices[selectedIndices.length - 1];
      const nChildren       = model.iter_n_children(parentIter);

      for (let n = 0; n < nChildren; n++) {
        const angle = this._get(model.iter_nth_child(parentIter, n)[1], 'ANGLE');

        if (n < selectedIndex && angle >= 0) {
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

    // Initialize the application-select-popover. On mouse-up the popover is hidden,
    // whenever an application is selected, the item's name, icon and command input fields
    // are updated accordingly.
    this._builder.get_object('application-popover-list')
        .connect('button-release-event', () => {
          this._builder.get_object('item-application-popover').popdown();
        });

    this._builder.get_object('application-popover-list')
        .connect('application-selected', (widget, app) => {
          this._builder.get_object('icon-name').text    = app.get_icon().to_string();
          this._builder.get_object('item-name').text    = app.get_display_name();
          this._builder.get_object('item-command').text = app.get_commandline();
        });

    // Initialize the two shortcut-select elements. See the documentation of
    // _initShortcutSelect for details.
    this._itemShortcutLabel =
        this._initShortcutSelect('item-shortcut-select', true, 'DATA');
    this._menuShortcutLabel =
        this._initShortcutSelect('menu-shortcut-select', false, 'SHORTCUT');


    // When the currently selected menu item changes, the content of the settings widgets
    // must be updated accordingly.
    this._selection.connect('changed', (selection) => {
      // Some widgets are disabled if nothing is selected.
      let somethingSelected = selection.get_selected()[0];
      this._builder.get_object('preview-menu-button').sensitive = somethingSelected;
      this._builder.get_object('remove-item-button').sensitive  = somethingSelected;

      // The action types list is only available if something is selected and if a
      // top-level element is selected, this must be a custom menu.
      let actionsSensitive = somethingSelected;
      if (this._isToplevelSelected()) {
        actionsSensitive = this._getSelected('TYPE') == 'CustomMenu';
      }
      this._builder.get_object('action-types-list').sensitive = actionsSensitive;

      // There are multiple Gtk.Revealers involved. Based on the selected item's type
      // their content is either shown or hidden. First we assume that all are hidden
      // and selectively set them to be shown. All settings are invisible if nothing is
      // selected, the menu settings (shortcut, centered) are visible if a top-level
      // element is selected, for all other items the fixed angle can be set.
      const revealers = {
        'item-settings-revealer': somethingSelected,
        'item-settings-menu-revealer': this._isToplevelSelected(),
        'item-settings-angle-revealer': !this._isToplevelSelected(),
        'item-settings-item-shortcut-revealer': false,
        'item-settings-count-revealer': false,
        'item-settings-uri-revealer': false,
        'item-settings-command-revealer': false,
        'item-settings-file-revealer': false,
        'item-settings-text-revealer': false,
        'item-settings-id-revealer': false
      };

      if (somethingSelected) {

        const selectedType = this._getSelected('TYPE');

        // If rows are not yet fully added, it may happen that the type is not yet set.
        if (selectedType == null) {
          return;
        }

        // Setting the content of the widgets below will actually trigger menu treestore
        // modifications which in turn would lead to saving the menu configuration. As
        // this is not necessary, we disable saving temporarily.
        this._menuSavingAllowed = false;

        const selectedDataType = ItemRegistry.getItemTypes()[selectedType].dataType;

        // The item's name, icon and description have to be updated in any case if
        // something is selected.
        this._builder.get_object('icon-name').text = this._getSelected('ICON');
        this._builder.get_object('item-name').text = this._getSelected('NAME');
        this._builder.get_object('item-description').label =
            ItemRegistry.getItemTypes()[selectedType].description;

        // If the selected item is a top-level menu, the SHORTCUT column contains its
        // shortcut.
        if (this._isToplevelSelected()) {
          this._menuShortcutLabel.set_accelerator(this._getSelected('SHORTCUT'));
          this._builder.get_object('menu-centered').active =
              this._getSelected('CENTERED');
        }
        // For all other items, the fixed angle can be set.
        else {
          this._builder.get_object('item-angle').value = this._getSelected('ANGLE');
        }

        if (selectedDataType == Enums.ItemDataType.SHORTCUT) {
          this._itemShortcutLabel.set_accelerator(this._getSelected('DATA'));
          revealers['item-settings-item-shortcut-revealer'] = true;

        } else if (selectedDataType == Enums.ItemDataType.URL) {
          this._builder.get_object('item-uri').text = this._getSelected('DATA');
          revealers['item-settings-uri-revealer']   = true;

        } else if (selectedDataType == Enums.ItemDataType.ID) {
          this._builder.get_object('item-id').text = this._getSelected('DATA');
          revealers['item-settings-id-revealer']   = true;

        } else if (selectedDataType == Enums.ItemDataType.FILE) {
          this._builder.get_object('item-file').text = this._getSelected('DATA');
          revealers['item-settings-file-revealer']   = true;

        } else if (selectedDataType == Enums.ItemDataType.COMMAND) {
          this._builder.get_object('item-command').text = this._getSelected('DATA');
          revealers['item-settings-command-revealer']   = true;

        } else if (selectedDataType == Enums.ItemDataType.COUNT) {
          this._builder.get_object('item-count').value = this._getSelected('DATA');
          revealers['item-settings-count-revealer']    = true;

        } else if (selectedDataType == Enums.ItemDataType.TEXT) {
          this._builder.get_object('item-text').text = this._getSelected('DATA');
          revealers['item-settings-text-revealer']   = true;
        }

        this._menuSavingAllowed = true;
      }

      // Finally update the state of all revealers.
      for (const revealer in revealers) {
        this._builder.get_object(revealer).reveal_child = revealers[revealer];
      }
    });

    // Initialize the tip-display label.
    this._initInfoLabel();
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
        iconList.set_value(iconList.append(), 0, icons[i + j]);
      }

      // This is effectively a 'yield'. We wait asynchronously for the timeout (1ms) to
      // resolve, letting other events to be processed in the meantime.
      await new Promise(r => GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1, r));
    }

    // Enable sorting again!
    iconList.set_sort_column_id(0, Gtk.SortType.ASCENDING);
  }


  // This creates / initializes a Gtk.ListBoxRow which can be used to select a shortcut. A
  // Gtk.ShortcutLabel is used to visualize the shortcut - this element is not yet
  // available in Glade, therefore it's created here in code. This makes everything a bit
  // hard-wired, which could be improved in the future.
  // The functionality is added to a Gtk.ListBoxRow identified via rowName. This row is
  // expected to have single Gtk.Box as child; the Gtk.ShortcutLabel will be packed to the
  // end of this Gtk.Box.
  // The doFullGrab parameters enables selection of shortcuts which are already bound to
  // something else. For example, imagine you have configured opening a terminal via
  // Ctrl+Alt+T in your system settings. Now if doFullGrab == false, selecting Ctrl+Alt+T
  // will not work; it will open the terminal instead. However, if doFullGrab == true, you
  // will be able to select Ctrl+Alt+T. This is very important - we do not want to bind
  // menus to shortcuts which are bound to something else - but we want menu items to
  // simulate shortcut presses which are actually bound to something else!
  _initShortcutSelect(rowName, doFullGrab, dataColumn) {

    const row = this._builder.get_object(rowName);

    // Translators: This is shown on the shortcut-buttons when no shortcut is selected.
    const label = new Gtk.ShortcutLabel({disabled_text: _('Not bound.')});
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
      label.set_disabled_text(
          _('Press the shortcut!\nESC to cancel, BackSpace to unbind'));
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
      label.set_disabled_text(_('Not bound.'));
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
          // Escape cancels the shortcut selection.
          label.set_accelerator(this._getSelected(dataColumn));
          cancelGrab();

        } else if (keyval == Gdk.KEY_BackSpace) {
          // BackSpace removes any bindings.
          label.set_accelerator('');
          this._setSelected(dataColumn, '');
          cancelGrab();

        } else if (Gtk.accelerator_valid(keyval, mods)) {
          // Else, if a valid accelerator was pressed, we store it.
          const accelerator = Gtk.accelerator_name(keyval, mods);
          this._setSelected(dataColumn, accelerator);
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

  // There is a small label in the menu editor which shows random tips at regular
  // intervals.
  _initInfoLabel() {
    const revealer = this._builder.get_object('info-label-revealer');
    const label    = this._builder.get_object('info-label');

    const tips = [
      _('You should try to have no more than twelve items in your menus.'),
      _('You will find it more easy to learn item positions if you have an even number of entries. Four, six and eight are good numbers.'),
      _('The source code of Fly-Pie is available on <a href="https://github.com/Schneegans/Fly-Pie">Github</a>.'),
      _('Suggestions can be posted on <a href="https://github.com/Schneegans/Fly-Pie/issues">Github</a>.'),
      _('Bugs can be reported on <a href="https://github.com/Schneegans/Fly-Pie/issues">Github</a>.'),
      _('Deep hierarchies are pretty efficient. Put menus into menus in menus!'),
      _('If you delete all menus, log out and log in again, the default configuration will be restored.'),
      _('You can reorder the menu items on the left via drag and drop.'),
      _('You can drop directories, files, links and desktop files to the menu hierarchy on the left.'),
      _('You can copy menu items by holding the Control key while dragging them to another location.')
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
      return label.get_toplevel().visible;
    });

    label.connect('destroy', () => {
      GLib.source_remove(this._infoLabelTimeoutA);
      GLib.source_remove(this._infoLabelTimeoutB);
    });
  }

  // This adds a new menu item to the currently selected menu. Items will always be
  // inserted as a sibling following the currently selected item. This is except for
  // action items added to top-level menus, here we add them as a child.
  _addNewItem(newType) {

    const [ok, model, selected] = this._selection.get_selected();
    let iter;

    if (ok) {
      if (this._isToplevelSelected() &&
          ItemRegistry.getItemTypes()[newType].itemClass == Enums.ItemClass.ACTION) {
        iter = this._store.append(selected);
      } else {
        iter = this._store.insert_after(null, selected);
      }
    }
    // If nothing is selected, this will only be called for items of the menu class. We
    // add them to the end.
    else {
      iter = this._store.append(null);
    }

    // New Menus will get a random emoji icon. All other items will get a name
    // and icon according to the item registry.
    if (newType == 'CustomMenu') {
      this._set(iter, 'ICON', this._getRandomEmoji());
    } else {
      this._set(iter, 'ICON', ItemRegistry.getItemTypes()[newType].icon);
    }

    // Assign a new ID for top-level items.
    if (this._isToplevelSelected()) {
      this._set(iter, 'ID', this._getNewID());
    } else {
      this._set(iter, 'ID', -1);
    }

    // Initialize other field to their default values.
    this._set(iter, 'TYPE', newType);
    this._set(iter, 'NAME', ItemRegistry.getItemTypes()[newType].name);
    this._set(iter, 'DATA', ItemRegistry.getItemTypes()[newType].defaultData);
    this._set(iter, 'ANGLE', -1);
    this._set(iter, 'SHORTCUT', '');
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
      text: _('Do you really want to delete the selected item?'),
      secondary_text: _('This cannot be undone!')
    });

    // Delete the item on a positive response.
    dialog.connect('response', (dialog, id) => {
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
  // of the column - that is for example "ICON", "ANGLE", or "TYPE". This function will
  // automatically set the values of "DISPLAY_ICON", "DISPLAY_ANGLE", and "DISPLAY_NAME"
  // when "ICON", "ANGLE", "NAME", or "DATA" are set. Furthermore, it will automatically
  // save a JSON representation of the entire menu store to the "menu-configuration"
  // Gio.Settings key of this application.
  _set(iter, column, data) {

    const isDataColumn =
        column != 'DISPLAY_ICON' && column != 'DISPLAY_ANGLE' && column != 'DISPLAY_NAME';

    // First, store the given value.
    this._store.set_value(iter, this._store.columns[column], data);

    // If the icon, was set, update the "DISPLAY_ICON" as well.
    if (column == 'ICON') {
      let iconSize = this._isToplevel(iter) ? 24 : 16;
      this._set(iter, 'DISPLAY_ICON', utils.createIcon(data, iconSize));
    }

    // If the angle, was set, update the "DISPLAY_ANGLE" as well. For top-level menus,
    // this field contains the menu ID, so we update the DISPLAY_ANGLE only for
    // non-top-level menus.
    if (column == 'ANGLE') {
      if (!this._isToplevel(iter)) {
        this._set(iter, 'DISPLAY_ANGLE', data >= 0 ? data : '');
      }
    }

    // If the name, was set, update the "DISPLAY_NAME" as well. If iter refers to a
    // top-level menu, the display name contains the shortcut.
    if (column == 'NAME') {
      if (this._isToplevel(iter)) {
        let shortcut      = _('Not bound.');
        const accelerator = this._get(iter, 'SHORTCUT');
        if (accelerator) {
          const [keyval, mods] = Gtk.accelerator_parse(accelerator);
          shortcut             = Gtk.accelerator_get_label(keyval, mods);
        }
        this._set(
            iter, 'DISPLAY_NAME',
            '<b>' + GLib.markup_escape_text(data, -1) + '</b>\n<small>' + shortcut +
                '</small>');
      } else {
        this._set(iter, 'DISPLAY_NAME', GLib.markup_escape_text(data, -1));
      }
    }

    // If the data column was set on a top-level menu, we need to update the
    // "DISPLAY_NAME" as well, as the shortcut is displayed in the cellrenderer.
    if (column == 'SHORTCUT') {
      if (this._isToplevel(iter)) {
        let shortcut = _('Not bound.');
        if (data != '') {
          const [keyval, mods] = Gtk.accelerator_parse(data);
          shortcut             = Gtk.accelerator_get_label(keyval, mods);
        }
        const name = this._get(iter, 'NAME');
        this._set(
            iter, 'DISPLAY_NAME', '<b>' + name + '</b>\n<small>' + shortcut + '</small>');
      }
    }

    // If loading has finished, any modifications to the tree store are directly committed
    // to the "menu-configuration" settings key.
    if (isDataColumn && this._menuSavingAllowed) {
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

      let [ok, iter] = this._store.get_iter_first();

      while (ok && !isInUse) {
        if (this._get(iter, 'ID') == newID) {
          isInUse = true;
        }
        ok = this._store.iter_next(iter);
      }

    } while (isInUse);

    return newID;
  }

  // This stores a JSON representation of the entire menu store in the
  // "menu-configuration" key of the application settings. This is called whenever
  // something is changed in the menu store. It does not update the settings
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

      // This is called recursively.
      const addChildren = (parent, parentIter) => {
        // Recursively add all children.
        const count = this._store.iter_n_children(parentIter);

        if (count > 0) {
          parent.children = [];
        }

        for (let i = 0; i < count; ++i) {
          const iter = this._store.iter_nth_child(parentIter, i)[1];
          let item   = {
            name: this._get(iter, 'NAME'),
            icon: this._get(iter, 'ICON'),
            type: this._get(iter, 'TYPE'),
            data: this._get(iter, 'DATA'),
            angle: this._get(iter, 'ANGLE')
          };

          parent.children.push(item);

          addChildren(item, iter);
        }
      };

      // The top level JSON element is an array containing all menus.
      let menus      = [];
      let [ok, iter] = this._store.get_iter_first();

      while (ok) {
        let menu = {
          name: this._get(iter, 'NAME'),
          icon: this._get(iter, 'ICON'),
          type: this._get(iter, 'TYPE'),
          data: this._get(iter, 'DATA'),
          shortcut: this._get(iter, 'SHORTCUT'),
          id: this._get(iter, 'ID'),
          centered: this._get(iter, 'CENTERED'),
        };

        menus.push(menu);
        addChildren(menu, iter);

        ok = this._store.iter_next(iter);
      }

      // Save the configuration as JSON!
      this._settings.set_string('menu-configuration', JSON.stringify(menus));

      return false;
    });
  }


  // This is called once initially and loads the JSON menu configuration from the settings
  // key "menu-configuration". It populates the menu store with all configured menus.
  _loadMenuConfiguration() {

    // This prevents callbacks on the row-inserted signal during initialization.
    this._menuSavingAllowed = false;

    // Remove any previously loaded configuration.
    this._store.clear();

    // This is called recursively.
    const parseChildren = (parent, parentIter) => {
      // Load all children recursively.
      if (parent.children) {
        for (let j = 0; j < parent.children.length; j++) {
          const child = parent.children[j];
          const iter  = this._store.append(parentIter);

          this._set(iter, 'ICON', child.icon);
          this._set(iter, 'NAME', child.name);
          this._set(iter, 'TYPE', child.type);
          this._set(iter, 'DATA', child.data);
          this._set(iter, 'ANGLE', child.angle);
          this._set(iter, 'SHORTCUT', '');

          parseChildren(child, iter);
        }
      }
    };

    // Load the menu configuration in the JSON format.
    const configs = JSON.parse(this._settings.get_string('menu-configuration'));

    for (let i = 0; i < configs.length; i++) {
      const config = configs[i];
      const iter   = this._store.append(null);

      ItemRegistry.normalizeConfig(config);

      this._set(iter, 'ICON', config.icon);
      this._set(iter, 'NAME', config.name);
      this._set(iter, 'TYPE', config.type);
      this._set(iter, 'DATA', config.data);
      this._set(iter, 'SHORTCUT', config.shortcut);
      this._set(iter, 'CENTERED', config.centered);
      this._set(iter, 'ID', config.id != undefined ? config.id : this._getNewID());

      parseChildren(config, iter);
    }

    // Flag that loading is finished - all next calls to this._set() will update the
    // "menu-configuration".
    this._menuSavingAllowed = true;
  }
}