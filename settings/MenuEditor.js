//////////////////////////////////////////////////////////////////////////////////////////
//   _____       _             _____ _                                                  //
//  |   __|_ _ _|_|___ ___ ___|  _  |_|___   This software may be modified and distri-  //
//  |__   | | | | |   | . |___|   __| | -_|  buted under the terms of the MIT license.  //
//  |_____|_____|_|_|_|_  |   |__|  |_|___|  See the LICENSE file for details.          //
//                    |___|                                                             //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Cairo                     = imports.cairo;
const {GObject, GLib, Gtk, Gio} = imports.gi;

const Me            = imports.misc.extensionUtils.getCurrentExtension();
const utils         = Me.imports.common.utils;
const DBusInterface = Me.imports.common.DBusInterface.DBusInterface;

const DBusWrapper = Gio.DBusProxy.makeProxyWrapper(DBusInterface.description);

// These are the different columns of the MenuTreeStore. It contains basically all data of
// all configured menus. This could be a static member of the class below, but this seems
// to be not supported yet.
// clang-format off
let ColumnTypes = {
  DISPLAY_ICON:     Cairo.Surface.$gtype,  // The actual pixbuf of the icon.
  DISPLAY_NAME:     GObject.TYPE_STRING,   // The name with markup. 
  DISPLAY_ANGLE:    GObject.TYPE_STRING,   // Empty if angle is -1
  DETAILS:          GObject.TYPE_STRING,   // The text of the middle column.
  ICON:             GObject.TYPE_STRING,   // The string representation of the icon.
  NAME:             GObject.TYPE_STRING,   // The name without any markup.
  TYPE:             GObject.TYPE_STRING,   // The item type. Like 'menu' or 'url'.
  DATA:             GObject.TYPE_STRING,   // Used for the command, file, application, ...
  COUNT:            GObject.TYPE_DOUBLE,   // The max-item-count of some sub-menus.
  ANGLE:            GObject.TYPE_DOUBLE    // The fixed angle.
}
// clang-format on

//////////////////////////////////////////////////////////////////////////////////////////
// The MenuTreeStore differs from a normal Gtk.TreeStore only in the drag'n'drop        //
// behavior. It ensures that top-level menus cannot be dragged at all and the all       //
// other items or sub-menus are only dropped to top-level menus or to sub-menus.        //
//////////////////////////////////////////////////////////////////////////////////////////

let MenuTreeStore = GObject.registerClass({}, class MenuTreeStore extends Gtk.TreeStore {
  _init() {
    super._init();

    let columnTypes = [];
    this.columns    = {};

    let lastColumnID = -1;
    for (const name in ColumnTypes) {
      columnTypes.push(ColumnTypes[name]);
      this.columns[name] = ++lastColumnID;
    }

    this.set_column_types(columnTypes);
  }

  // This makes sure that we cannot drag top-level menus. All other items or sub-menus can
  // be dragged around.
  vfunc_row_draggable(path) {
    return path.get_depth() > 1;
  }

  // This ensures that items or sub-menus are only dropped on top-level menus or
  // sub-menus.
  vfunc_row_drop_possible(path) {
    const parentPath = path.copy();
    if (parentPath.up()) {
      const [ok, parent] = this.get_iter(parentPath);
      if (ok) {
        const type = this.get_value(parent, this.columns.TYPE);
        if (type == 'submenu' || type == 'menu') {
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
// quite decoupled as well, it structures the code better when written to its own file. //
//////////////////////////////////////////////////////////////////////////////////////////

var MenuEditor = class MenuEditor {

  // ------------------------------------------------------------ constructor / destructor

  constructor(builder) {

    this._builder = builder;

    // Create the Gio.Settings object.
    this._settings = utils.createSettings();

    // Connect to the server so that we can toggle menu previews from the menu editor.
    new DBusWrapper(
        Gio.DBus.session, 'org.gnome.Shell', '/org/gnome/shell/extensions/swingpie',
        proxy => this._dbus = proxy);

    let menus = [
      {
        type: 'menu',
        icon: 'gedit',
        name: 'Main Menu',
        data: 'Ctrl+A',
        fixedAngle: -1,
        children: []
      },
      {
        type: 'menu',
        icon: 'thunderbird',
        name: 'Main Menu 2',
        data: 'Ctrl+B',
        fixedAngle: -1,
        children: [
          {
            type: 'submenu',
            icon: 'emblem-default',
            name: 'Favorites',
            data: '',
            fixedAngle: 90,
          },
          {
            type: 'application',
            icon: 'firefox',
            name: 'Firefox',
            data: 'Firefox',
            fixedAngle: -1,
          },
          {
            type: 'command',
            icon: 'terminal',
            name: 'Grep',
            data: 'grep foo',
            fixedAngle: -1,
          },
          {
            type: 'hotkey',
            icon: 'H',
            name: 'Hotkey',
            data: 'Ctrl+V',
            fixedAngle: 270,
          },
        ]
      },
      {
        type: 'menu',
        icon: 'chrome',
        name: 'Main Menu 3',
        data: 'Ctrl+C',
        fixedAngle: -1,
        children: [
          {
            type: 'bookmarks-group',
            icon: 'nautilus',
            name: 'Bookmarks',
            data: '',
            fixedAngle: -1,
          },
          {
            type: 'url',
            icon: 'epiphany',
            name: 'URL',
            data: 'http://www.google.de',
            fixedAngle: -1,
          },
          {
            type: 'file',
            icon: 'nautilus',
            name: 'File',
            data: 'file://huhu',
            fixedAngle: -1,
          },
        ]
      },
    ];

    try {
      // Create our custom tree store and assign it to the tree view of the builder.
      this._store = new MenuTreeStore();
      this._view  = this._builder.get_object('menus-treeview');
      this._view.set_model(this._store);

      const menuColumn = new Gtk.TreeViewColumn({title: 'Menu Structure', expand: true});
      const iconRender = new Gtk.CellRendererPixbuf();
      const nameRender = new Gtk.CellRendererText({xpad: 5});
      menuColumn.pack_start(iconRender, false);
      menuColumn.pack_start(nameRender, true);
      menuColumn.add_attribute(iconRender, 'surface', this._store.columns.DISPLAY_ICON);
      menuColumn.add_attribute(nameRender, 'markup', this._store.columns.DISPLAY_NAME);

      const detailsColumn = new Gtk.TreeViewColumn({title: 'Item Details', expand: true});
      const detailsRender = new Gtk.CellRendererText();
      detailsRender.sensitive = false;
      detailsColumn.pack_start(detailsRender, true);
      detailsColumn.add_attribute(detailsRender, 'markup', this._store.columns.DETAILS);

      const angleColumn = new Gtk.TreeViewColumn({title: 'Fixed Angle', expand: true});
      const angleRender = new Gtk.CellRendererText();
      angleRender.sensitive = false;
      angleColumn.pack_start(angleRender, true);
      angleColumn.add_attribute(angleRender, 'markup', this._store.columns.DISPLAY_ANGLE);

      this._view.append_column(menuColumn);
      this._view.append_column(detailsColumn);
      this._view.append_column(angleColumn);


      for (let i = 0; i < menus.length; i++) {
        const menu = menus[i];
        const iter = this._store.append(null);

        this._set(iter, 'ICON', menu.icon);
        this._set(iter, 'NAME', menu.name);
        this._set(iter, 'TYPE', menu.type);
        this._set(iter, 'DATA', menu.data);
        this._set(iter, 'ANGLE', menu.fixedAngle);


        for (let j = 0; j < menu.children.length; j++) {
          const child     = menu.children[j];
          const childIter = this._store.append(iter);

          this._set(childIter, 'ICON', child.icon);
          this._set(childIter, 'NAME', child.name);
          this._set(childIter, 'TYPE', child.type);
          this._set(childIter, 'DATA', child.data);
          this._set(childIter, 'ANGLE', child.fixedAngle);
        }
      }
    } catch (error) {
      utils.notification('Failed to initialize Menu Editor: ' + error);
    }

    this._selection = this._builder.get_object('menus-treeview-selection');
    this._selection.connect('changed', (selection) => {
      try {

        this._builder.get_object('icon-name').text   = this._getSelected('ICON');
        this._builder.get_object('item-name').text   = this._getSelected('NAME');
        this._builder.get_object('item-angle').value = this._getSelected('ANGLE');

        const revealers = {
          'item-settings-revealer': true,
          'item-settings-menu-hotkey-revealer': false,
          'item-settings-item-hotkey-revealer': false,
          'item-settings-angle-revealer': false,
          'item-settings-count-revealer': false,
          'item-settings-url-revealer': false,
          'item-settings-command-revealer': false,
          'item-settings-file-revealer': false,
          'item-settings-application-revealer': false,
        };

        const type = this._getSelected('TYPE');

        if (type == 'menu') {
          revealers['item-settings-menu-hotkey-revealer'] = true;
        } else {
          revealers['item-settings-angle-revealer'] = true;

          if (type == 'application') {
            revealers['item-settings-application-revealer'] = true;
          } else if (type == 'hotkey') {
            revealers['item-settings-item-hotkey-revealer'] = true;
          } else if (type == 'url') {
            revealers['item-settings-url-revealer'] = true;
          } else if (type == 'file') {
            revealers['item-settings-file-revealer'] = true;
          } else if (type == 'command') {
            revealers['item-settings-command-revealer'] = true;
          } else if (type != 'submenu') {
            revealers['item-settings-count-revealer'] = true;
          }
        }

        for (const revealer in revealers) {
          this._builder.get_object(revealer).reveal_child = revealers[revealer];
        }
      } catch (error) {
        utils.notification('Failed to update menu configuration: ' + error);
      }
    });



    this._loadIcons().then(() => {
      this._builder.get_object('icon-load-spinner').active = false;
    });

    const iconListFiltered = this._builder.get_object('icon-list-filtered');
    const filterEntry      = this._builder.get_object('icon-filter-entry');
    iconListFiltered.set_visible_func((model, iter) => {
      const name = model.get_value(iter, 0);
      if (name == null) {
        return false;
      }
      return name.toLowerCase().includes(filterEntry.text.toLowerCase());
    });

    // refilter on input
    filterEntry.connect('notify::text', () => {
      iconListFiltered.refilter();
    });

    const iconView = this._builder.get_object('icon-view');
    iconView.connect('item-activated', (view, path) => {
      const model      = view.get_model();
      const [ok, iter] = model.get_iter(path);
      if (ok) {
        this._builder.get_object('icon-name').text = model.get_value(iter, 0);
      }
    });

    const fileChooser = this._builder.get_object('icon-file-chooser');
    fileChooser.connect('file-activated', (chooser) => {
      this._builder.get_object('icon-name').text = chooser.get_filename();
    });

    this._builder.get_object('item-name').connect('notify::text', (widget) => {
      this._setSelected('NAME', widget.text);
    });

    this._builder.get_object('item-angle').connect('value-changed', (adjustment) => {
      let minAngle                     = -1
      let maxAngle                     = 360
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

      if (adjustment.value == -1 ||
          (adjustment.value > minAngle && adjustment.value < maxAngle)) {
        this._setSelected('ANGLE', adjustment.value);
      }
    });

    this._builder.get_object('icon-name').connect('notify::text', (widget) => {
      this._setSelected('ICON', widget.text);
      this._itemIcon.queue_draw();
    });

    this._itemIcon = this._builder.get_object('item-icon-drawingarea');
    this._itemIcon.connect('draw', (widget, ctx) => {
      const size = Math.min(widget.get_allocated_width(), widget.get_allocated_height());
      const icon = this._getSelected('ICON');
      utils.paintIcon(ctx, icon, size, 1);
      return false;
    });

    this._hotkeyButton = this._builder.get_object('hotkey-button');
    this._hotkeyButton.connect('toggled', (widget) => {
      if (widget.active) {
        widget.set_label('Press a hotkey ...');
        widget.grab_add();
        // Gtk.grab_add(widget);
        // FocusGrabber.grab(this.get_window());
      } else {
        widget.grab_remove();
      }
    });
  }

  // ----------------------------------------------------------------------- private stuff

  async _loadIcons() {
    const iconList = this._builder.get_object('icon-list');
    iconList.set_sort_column_id(-2, Gtk.SortType.ASCENDING);

    const iconTheme = Gtk.IconTheme.get_default();
    const icons     = iconTheme.list_icons(null);
    const batchSize = 10;
    for (let i = 0; i < icons.length; i += batchSize) {
      for (let j = 0; j < batchSize && i + j < icons.length; j++) {
        iconList.set_value(iconList.append(null), 0, icons[i + j]);
      }
      await new Promise(r => GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1, r));
    }

    iconList.set_sort_column_id(0, Gtk.SortType.ASCENDING);
  }

  _isToplevel(iter) {
    return this._store.get_path(iter).get_depth() <= 1;
  }

  _isToplevelSelected() {
    const [ok, model, iter] = this._selection.get_selected();
    if (ok) {
      return model.get_path(iter).get_depth() <= 1;
    }
    return false;
  }

  _get(iter, columnName) {
    return this._store.get_value(iter, this._store.columns[columnName]);
  }

  _set(iter, columnName, data) {
    this._store.set_value(iter, this._store.columns[columnName], data);

    if (columnName == 'ICON') {
      let iconSize = this._isToplevel(iter) ? 24 : 16;
      this._set(iter, 'DISPLAY_ICON', utils.createIcon(data, iconSize));
    }

    if (columnName == 'ANGLE') {
      this._set(iter, 'DISPLAY_ANGLE', data >= 0 ? data : '');
    }

    if (columnName == 'NAME') {
      if (this._isToplevel(iter)) {
        const hotkey = this._get(iter, 'DATA');
        this._set(iter, 'DISPLAY_NAME', '<b>' + data + '</b>\n' + hotkey);
      } else {
        this._set(iter, 'DISPLAY_NAME', data);
      }
    }

    if (columnName == 'DATA') {
      if (this._isToplevel(iter)) {
        const name = this._get(iter, 'NAME');
        this._set(
            iter, 'DISPLAY_NAME', '<b>' + name + '</b>\n<small>' + data + '</small>');
      } else {
        this._set(iter, 'DETAILS', data);
      }
    }
  }

  _getSelected(columnName) {
    const [ok, model, iter] = this._selection.get_selected();
    if (ok) {
      return this._get(iter, columnName);
    }
  }

  _setSelected(columnName, data) {
    const [ok, model, iter] = this._selection.get_selected();
    if (ok) {
      this._set(iter, columnName, data);
    }
  }
}