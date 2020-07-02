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

var MenuTreeColumn = {
  ICON: 0,
  ICON_NAME: 1,
  NAME: 2,
  DESCRIPTION: 3,
  ID: 4,
  TYPE: 5,
  DATA: 6,
  FIXED_ANGLE: 7,
}

let MenuTree = GObject.registerClass({}, class MenuTree extends Gtk.TreeStore {
  _init() {
    super._init();

    this.set_column_types([
      Cairo.Surface.$gtype,  // 0: ICON
      GObject.TYPE_STRING,   // 1: ICON_NAME
      GObject.TYPE_STRING,   // 2: NAME
      GObject.TYPE_STRING,   // 3: DESCRIPTION
      GObject.TYPE_STRING,   // 4: ID
      GObject.TYPE_STRING,   // 5: TYPE
      GObject.TYPE_STRING,   // 6: DATA
      GObject.TYPE_DOUBLE,   // 7: FIXED_ANGLE
    ]);
  }

  vfunc_row_draggable(path) {
    return path.get_depth() > 1;
  }

  vfunc_row_drop_possible(path) {
    const parentPath = path.copy();
    if (parentPath.up()) {
      const [ok, parent] = this.get_iter(parentPath);
      if (ok) {
        const type = this.get_value(parent, MenuTreeColumn.TYPE);
        if (type == 'group' || type == 'menu') {
          return true;
        }
      }
    }
    return false;
  }
});

//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////

var MenuEditor = class MenuEditor {

  // ------------------------------------------------------------ constructor / destructor

  constructor(builder) {

    this._builder = builder;

    // Create the Gio.Settings object.
    this._settings = utils.createSettings();

    // Connect to the server so that we can toggle menus also from the preferences. This
    // is, for example, used for toggling the Live-Preview.
    new DBusWrapper(
        Gio.DBus.session, 'org.gnome.Shell', '/org/gnome/shell/extensions/swingpie',
        proxy => this._dbus = proxy);

    // Now on to the Menus page.
    let menus = [
      {
        id: 'menu01',
        type: 'menu',
        icon: 'gedit',
        name: '<b>Main Menu</b>\n<small>Ctrl+A</small>',
        description: '',
        data: 'data',
        fixedAngle: -1,
        children: []
      },
      {
        id: 'menu02',
        type: 'menu',
        icon: 'thunderbird',
        name: '<b>Main Menu 2</b>\n<small>Ctrl+B</small>',
        description: '',
        data: 'data',
        fixedAngle: -1,
        children: [
          {
            id: 'menu01',
            type: 'group',
            icon: 'emblem-default',
            name: 'Favorites',
            description: '[group]',
            data: 'data',
            fixedAngle: -1,
          },
          {
            id: 'menu01',
            type: 'application',
            icon: 'firefox',
            name: 'Firefox',
            description: '[application]',
            data: 'data',
            fixedAngle: -1,
          },
        ]
      },
      {
        id: 'menu03',
        type: 'menu',
        icon: 'chrome',
        name: '<b>Main Menu 3</b>\n<small>Ctrl+C</small>',
        description: '',
        data: 'data',
        fixedAngle: -1,
        children: [
          {
            id: 'menu01',
            type: 'bookmarks-group',
            icon: 'nautilus',
            name: 'Bookmarks',
            description: '[bookmarks]',
            data: 'data',
            fixedAngle: -1,
          },
          {
            id: 'menu01',
            type: 'url',
            icon: 'epiphany',
            name: 'URL',
            description: '[http://www.google.de]',
            data: 'data',
            fixedAngle: -1,
          },
        ]
      },
    ];

    try {
      this._menuTree     = new MenuTree();
      this._menuTreeView = this._builder.get_object('menus-treeview');
      this._menuTreeView.set_model(this._menuTree);

      const primaryColumn = new Gtk.TreeViewColumn();

      const iconRender = new Gtk.CellRendererPixbuf();
      primaryColumn.pack_start(iconRender, false);

      const nameRender = new Gtk.CellRendererText();
      nameRender.xpad  = 5;
      primaryColumn.pack_start(nameRender, true);

      primaryColumn.add_attribute(iconRender, 'surface', MenuTreeColumn.ICON);
      primaryColumn.add_attribute(nameRender, 'markup', MenuTreeColumn.NAME);

      this._menuTreeView.append_column(primaryColumn);


      const secondaryColumn = new Gtk.TreeViewColumn();

      const descriptionRender     = new Gtk.CellRendererText();
      descriptionRender.sensitive = false;
      secondaryColumn.pack_start(descriptionRender, true);
      secondaryColumn.add_attribute(
          descriptionRender, 'markup', MenuTreeColumn.DESCRIPTION);

      this._menuTreeView.append_column(secondaryColumn);


      for (let i = 0; i < menus.length; i++) {
        const menu = menus[i];
        const iter = this._menuTree.append(null);

        this._menuTree.set(iter, [0, 1, 2, 3, 4, 5, 6, 7], [
          utils.createIcon(menu.icon, 24),
          menu.icon,
          menu.name,
          menu.description,
          menu.id,
          menu.type,
          menu.data,
          menu.fixedAngle,
        ]);
        for (let j = 0; j < menu.children.length; j++) {
          const child = menu.children[j];
          this._menuTree.set(this._menuTree.append(iter), [0, 1, 2, 3, 4, 5, 6, 7], [
            utils.createIcon(child.icon, 16),
            child.icon,
            child.name,
            child.description,
            child.id,
            child.type,
            child.data,
            child.fixedAngle,
          ]);
        }
      }
    } catch (error) {
      utils.notification('Failed to load Preset: ' + error);
    }

    this._menuTreeSelection = this._builder.get_object('menus-treeview-selection');
    this._menuTreeSelection.connect('changed', (selection) => {
      try {

        this._itemIcon.queue_draw();

        const [ok, model, iter] = selection.get_selected();
        if (ok) {
          const type = model.get_value(iter, MenuTreeColumn.TYPE);

          const revealers = {
            'item-settings-hotkey-revealer': false,
            'item-settings-angle-revealer': false,
            'item-settings-count-revealer': false,
            'item-settings-url-revealer': false,
            'item-settings-command-revealer': false,
            'item-settings-file-revealer': false,
            'item-settings-application-revealer': false,
          };

          if (type == 'menu') {
            revealers['item-settings-hotkey-revealer'] = true;
          } else {
            revealers['item-settings-angle-revealer'] = true;

            if (type == 'application') {
              revealers['item-settings-application-revealer'] = true;
            } else if (type == 'url') {
              revealers['item-settings-url-revealer'] = true;
            } else if (type == 'file') {
              revealers['item-settings-file-revealer'] = true;
            } else if (type == 'command') {
              revealers['item-settings-command-revealer'] = true;
            } else if (type != 'group') {
              revealers['item-settings-count-revealer'] = true;
            }
          }

          for (const revealer in revealers) {
            this._builder.get_object(revealer).reveal_child = revealers[revealer];
          }
        }
      } catch (error) {
        utils.notification('Failed to load Preset: ' + error);
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

    this._builder.get_object('icon-name').connect('notify::text', (widget) => {
      let iconSize = 24;

      if (this._getSelectedMenuItem().path.get_depth() > 1) {
        iconSize = 16;
      }

      this._setSelectedMenuItem(
          MenuTreeColumn.ICON, utils.createIcon(widget.text, iconSize));
      this._setSelectedMenuItem(MenuTreeColumn.ICON_NAME, widget.text);
      this._itemIcon.queue_draw();
    });

    this._itemIcon = this._builder.get_object('item-icon-drawingarea');
    this._itemIcon.connect('draw', (widget, ctx) => {
      const size = Math.min(widget.get_allocated_width(), widget.get_allocated_height());
      const selected = this._getSelectedMenuItem();
      if (selected[MenuTreeColumn.ICON_NAME]) {
        utils.paintIcon(ctx, selected[MenuTreeColumn.ICON_NAME], size, 1);
      }
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

  _getSelectedMenuItem() {
    let selected            = {};
    const [ok, model, iter] = this._menuTreeSelection.get_selected();
    if (ok) {
      selected.path = model.get_path(iter);
      for (const key in MenuTreeColumn) {
        selected[MenuTreeColumn[key]] = model.get_value(iter, MenuTreeColumn[key]);
      }
    }
    return selected;
  }

  _setSelectedMenuItem(column, data) {
    const [ok, model, iter] = this._menuTreeSelection.get_selected();
    if (ok) {
      model.set_value(iter, column, data);
    }
  }
}