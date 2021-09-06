//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const {GLib, GObject, Gtk, Gio, Gdk, Pango} = imports.gi;

const _ = imports.gettext.domain('flypie').gettext;

const Me            = imports.misc.extensionUtils.getCurrentExtension();
const utils         = Me.imports.src.common.utils;
const ItemRegistry  = Me.imports.src.common.ItemRegistry.ItemRegistry;
const ItemClass     = Me.imports.src.common.ItemRegistry.ItemClass;
const AnimatedValue = Me.imports.src.prefs.AnimatedValue.AnimatedValue;

//////////////////////////////////////////////////////////////////////////////////////////
// This is the canvas where the editable menu is drawn to. It's a custom container      //
// widget and we use standard widgets such as GtkLabels and GtkButtons to draw the      //
// menu.                                                                                //
//////////////////////////////////////////////////////////////////////////////////////////

let FlyPieMenuEditorItem;

const ItemState = {
  GRID: 0,
  CENTER: 1,
  CHILD: 2
};

const ItemSize = [130, 120, 100];

function registerWidget() {

  if (GObject.type_from_name('FlyPieMenuEditorItem') == null) {
    // clang-format off
    FlyPieMenuEditorItem = GObject.registerClass({
      GTypeName: 'FlyPieMenuEditorItem',
    },
    class FlyPieMenuEditorItem extends Gtk.Revealer {
          // clang-format on
          _init(itemState) {
            super._init({});

            const overlay = new Gtk.Overlay();
            this.set_child(overlay);

            this.state = itemState;

            this.editButton = Gtk.Button.new_from_icon_name('document-edit-symbolic');
            this.editButton.add_css_class('pill-button');
            this.editButton.valign = Gtk.Align.START;
            this.editButton.halign = Gtk.Align.END;
            overlay.add_overlay(this.editButton);

            this.button = new Gtk.ToggleButton({
              margin_top: 5,
              margin_start: 5,
              margin_end: 5,
              margin_bottom: 5,
              has_frame: false
            });

            this.button.add_css_class('round-button');


            this.set_transition_type(Gtk.RevealerTransitionType.CROSSFADE);
            this.set_reveal_child(true);

            // Create the Gio.Settings object.
            this._settings = utils.createSettings();

            // An icon is drawn in any state.
            this._iconName = 'image-missing';
            this._icon     = new Gtk.DrawingArea({hexpand: true, vexpand: true});
            this._icon.set_draw_func((widget, ctx) => {
              const size =
                  Math.min(widget.get_allocated_width(), widget.get_allocated_height());
              ctx.translate(
                  (widget.get_allocated_width() - size) / 2,
                  (widget.get_allocated_height() - size) / 2);
              const font  = this._settings.get_string('font');
              const color = widget.get_style_context().get_color();
              utils.paintIcon(ctx, this._config.icon, size, 1, font, color);
              return false;
            });

            // Center items have no caption.
            if (itemState == ItemState.GRID || itemState == ItemState.CHILD) {
              this._nameLabel = new Gtk.Label({ellipsize: Pango.EllipsizeMode.MIDDLE});
              this._nameLabel.add_css_class('caption-heading');
            }

            if (itemState == ItemState.CENTER) {
              this._icon.margin_top    = 3;
              this._icon.margin_start  = 3;
              this._icon.margin_end    = 3;
              this._icon.margin_bottom = 3;
            }

            // The shortcut label is only required for the menu mode.
            if (itemState == ItemState.GRID) {
              this._shortcutLabel = new Gtk.Label(
                  {ellipsize: Pango.EllipsizeMode.MIDDLE, use_markup: true});
              this._shortcutLabel.add_css_class('caption');
              this._shortcutLabel.add_css_class('dim-label');
            }

            // In the menu state, the item consists of a big toggle button containing the
            // icon, a name label and a shortcut label.
            if (itemState == ItemState.GRID) {

              overlay.set_child(this.button);

              const box   = Gtk.Box.new(Gtk.Orientation.VERTICAL, 2);
              box.vexpand = true;
              this.button.set_child(box);
              box.append(this._icon);
              box.append(this._nameLabel);
              box.append(this._shortcutLabel);
            }

            // In the center state, the button is round and simply contains the icon.
            if (itemState == ItemState.CENTER) {

              overlay.set_child(this.button);
              this.button.set_child(this._icon);
            }

            // In the child state, the button is round, contains the icon and a label is
            // drawn underneath.
            if (itemState == ItemState.CHILD) {

              overlay.set_child(this.button);

              const box   = Gtk.Box.new(Gtk.Orientation.VERTICAL, 2);
              box.vexpand = true;
              this.button.set_child(box);
              box.append(this._icon);
              box.append(this._nameLabel);
            }
          }

          setConfig(config) {
            this._config = config;

            this.editButton.visible =
                this.state != ItemState.CENTER && config.type == 'CustomMenu';

            this._icon.queue_draw();

            if (this._nameLabel) {
              this._nameLabel.label = config.name;
            }

            if (this._shortcutLabel) {
              if (config.shortcut) {
                const [ok, keyval, mods]  = Gtk.accelerator_parse(config.shortcut);
                this._shortcutLabel.label = Gtk.accelerator_get_label(keyval, mods);
              } else {
                this._shortcutLabel.label = _('Not Bound');
              }
            }
          }

          getConfig() {
            return this._config;
          }

          getIconWidget() {
            return this._icon;
          }
        })
  }

  if (GObject.type_from_name('FlyPieMenuEditor') == null) {
    // clang-format off
      GObject.registerClass({
        GTypeName: 'FlyPieMenuEditor',
        Signals: {
          'select':          { param_types: [GObject.TYPE_INT]},
          'edit':            { param_types: [GObject.TYPE_INT]},
          'remove':          { param_types: [GObject.TYPE_INT]},
          'drop-item':       { param_types: [GObject.TYPE_STRING, GObject.TYPE_INT]},
          'drop-data':       { param_types: [GObject.TYPE_STRING, GObject.TYPE_INT]},
          'drop-item-into':  { param_types: [GObject.TYPE_STRING, GObject.TYPE_INT]},
          'drop-data-into':  { param_types: [GObject.TYPE_STRING, GObject.TYPE_INT]},
          'request-add':     { param_types: [Gdk.Rectangle.$gtype]},
          'go-back':         { param_types: []},
          'notification':    { param_types: [GObject.TYPE_STRING]},
        },
      },
      class FlyPieMenuEditor extends Gtk.Widget {
      // clang-format on
      _init(params = {}) {
        super._init(params);

        this._items = [];

        this._restartAnimation = false;

        this._selectedItem = null;
        this._centerItem   = null;

        this._lastColumnCount = null;
        this._lastDropColumn  = null;
        this._lastDropRow     = null;

        this._dropIndex  = null;
        this._dropRow    = null;
        this._dropColumn = null;

        this._dropTarget =
            new Gtk.DropTarget({actions: Gdk.DragAction.MOVE | Gdk.DragAction.COPY});
        this._dropTarget.set_gtypes([GObject.TYPE_STRING]);

        this._dropTarget.connect('accept', () => true);
        this._dropTarget.connect('leave', () => this._endDrag());
        this._dropTarget.connect('drop', (t, what) => {
          if (this._dropIndex == null) {
            return false;
          }

          const internalDrag = t.get_drop().get_drag() != null;
          if (internalDrag) {

            const config = JSON.parse(what);
            if (this._inMenuOverviewMode() &&
                ItemRegistry.getItemTypes()[config.type].class != ItemClass.MENU) {
              // Translators: This is shown as an in-app notification when the user
              // attempts to drag an action in the menu editor to the menu overview.
              this.emit(
                  'notification', _('Actions cannot be turned into toplevel menus.'));
              this._endDrag();
              return false;
            }

            this.emit('drop-item', what, this._dropIndex);
          } else {

            if (this._inMenuOverviewMode()) {
              this.emit(
                  'notification',
                  // Translators: This is shown as an in-app notification when the user
                  // attempts to drag external stuff to the menu editor's overview.
                  _('You can only create new Action items inside of Custom Menus.'));
              this._endDrag();
              return false;
            }

            if (t.get_drop().formats.contain_mime_type('text/uri-list')) {
              what.split(/\r?\n/).forEach((line, i) => {
                if (line != '') {
                  this.emit('drop-data', line, this._dropIndex + i);
                }
              });
            } else {
              this.emit('drop-data', what, this._dropIndex);
            }
          }

          this._endDrag();

          return true;
        });

        this._dropTarget.connect('motion', (t, x, y) => {
          if (this._inMenuOverviewMode()) {
            x -= this._gridOffsetX;
            y -= this._gridOffsetY;

            x = Math.max(0, Math.min(this._columnCount * ItemSize[ItemState.GRID], x));
            y = Math.max(0, Math.min(this._rowCount * ItemSize[ItemState.GRID], y));

            const dropZoneWidth = ItemSize[ItemState.GRID] / 4;

            if (x % ItemSize[ItemState.GRID] < dropZoneWidth ||
                x % ItemSize[ItemState.GRID] > ItemSize[ItemState.GRID] - dropZoneWidth) {
              this._dropColumn = Math.floor(x / ItemSize[ItemState.GRID] + 0.5);
              this._dropRow    = Math.floor(y / ItemSize[ItemState.GRID]);
              this._dropIndex  = Math.min(
                  this._items.length,
                  this._columnCount * this._dropRow + this._dropColumn);
            } else {
              this._dropColumn = null;
              this._dropRow    = null;
              this._dropIndex  = null;
            }
          } else {
          }

          this.queue_allocate();

          return Gdk.DragAction.MOVE;
        });

        this.add_controller(this._dropTarget);

        {
          this._backButton = new Gtk.Revealer({
            transition_type: Gtk.RevealerTransitionType.CROSSFADE,
            margin_start: 20,
            margin_end: 20,
            margin_top: 20,
            margin_bottom: 20,
            reveal_child: false
          });
          this._backButton.set_parent(this);

          // Assign a state so that it gets scaled like the other child buttons;
          this._backButton.state = ItemState.CHILD;

          const button = new Gtk.Button();
          button.add_css_class('pill-button');
          this._backButton.set_child(button);

          const icon = new Gtk.DrawingArea({
            margin_start: 10,
            margin_end: 10,
            margin_top: 10,
            margin_bottom: 10,
          });
          icon.set_draw_func((widget, ctx) => {
            const width  = widget.get_allocated_width();
            const height = widget.get_allocated_height();
            const size   = Math.min(width, height);
            if (this._parentAngle >= 0) {
              ctx.translate(width / 2, height / 2);
              ctx.rotate((this._parentAngle + 90) * Math.PI / 180);
              ctx.translate(-width / 2, -height / 2);
            }
            ctx.translate((width - size) / 2, (height - size) / 2);
            const color = widget.get_style_context().get_color();
            utils.paintIcon(ctx, 'go-previous-symbolic', size, 1, 'Sans', color);

            return false;
          });

          button.set_child(icon);

          button.connect('clicked', (b) => {
            this.emit('go-back');
          });
        }
      }

      vfunc_get_request_mode() {
        return Gtk.SizeRequestMode.WIDTH_FOR_HEIGHT;
      }

      vfunc_measure(orientation, for_size) {
        if (this._inMenuOverviewMode()) {
          if (orientation == Gtk.Orientation.HORIZONTAL) {
            return [ItemSize[ItemState.GRID] * 4, ItemSize[ItemState.GRID] * 4, -1, -1];
          }

          const columns = Math.floor(for_size / ItemSize[ItemState.GRID]);
          const rows    = Math.ceil(this._items.length / columns);

          const gridSize = rows * ItemSize[ItemState.GRID];

          return [gridSize, gridSize, -1, -1];
        }

        return [ItemSize[ItemState.GRID] * 4, ItemSize[ItemState.GRID] * 4, -1, -1];
      }

      vfunc_size_allocate(width, height, baseline) {

        const setAnimation = (item, time, startX, startY, endX, endY) => {
          if (item.x == undefined) {
            item.x       = new AnimatedValue();
            item.y       = new AnimatedValue();
            item.x.start = startX;
            item.y.start = startY;
          } else if (this._restartAnimation) {
            item.x.start = item.x.get(time);
            item.y.start = item.y.get(time);
          }
          item.x.end = endX;
          item.y.end = endY;

          if (this._restartAnimation) {
            item.x.startTime = time;
            item.x.endTime   = time + 200;
            item.y.startTime = time;
            item.y.endTime   = time + 200;
          }
        };

        const time    = GLib.get_monotonic_time() / 1000;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius  = ItemSize[ItemState.GRID] * 1.4;

        if (this._inMenuOverviewMode()) {

          this._columnCount = Math.floor(width / ItemSize[ItemState.GRID]);
          this._rowCount    = Math.ceil(this._items.length / this._columnCount);

          if (this._rowCount == 1) {
            this._columnCount = this._items.length;
          }

          this._gridOffsetX = (width - this._columnCount * ItemSize[ItemState.GRID]) / 2;
          this._gridOffsetY = (height - this._rowCount * ItemSize[ItemState.GRID]) / 2;

          if (this._columnCount != this._lastColumnCount ||
              this._dropColumn != this._lastDropColumn ||
              this._dropRow != this._lastDropRow) {
            this._lastColumnCount  = this._columnCount;
            this._lastDropRow      = this._dropRow;
            this._lastDropColumn   = this._dropColumn;
            this._restartAnimation = true;
          }

          for (let i = 0; i < this._items.length; i++) {

            const column = i % this._columnCount;
            const row    = Math.floor(i / this._columnCount);

            let dropZoneOffset = 0;

            if (row == this._dropRow) {
              const range    = 3;
              const strength = 15;

              if (column < this._dropColumn) {
                dropZoneOffset =
                    -Math.max(0, range - (this._dropColumn - column) + 1) * strength;
              } else {
                dropZoneOffset =
                    Math.max(0, range - (column - this._dropColumn)) * strength;
              }
            }

            const startX = this._gridOffsetX + column * ItemSize[ItemState.GRID] -
                ItemSize[ItemState.GRID] / 2;
            const startY = this._gridOffsetY + row * ItemSize[ItemState.GRID];
            const endX =
                this._gridOffsetX + column * ItemSize[ItemState.GRID] + dropZoneOffset;
            const endY = this._gridOffsetY + row * ItemSize[ItemState.GRID];

            if (i < this._items.length) {
              setAnimation(this._items[i], time, startX, startY, endX, endY);
            }
          }

        } else {

          this._items.forEach((item, i) => {
            const angle = this._itemAngles[i] * Math.PI / 180;
            let x       = Math.floor(Math.sin(angle) * radius) + centerX;
            let y       = -Math.floor(Math.cos(angle) * radius) + centerY;
            x -= ItemSize[item.state] / 2;
            y -= ItemSize[item.state] / 2;

            setAnimation(item, time, x, y, x, y);
          });

          let x = centerX - ItemSize[this._centerItem.state] / 2;
          let y = centerY - ItemSize[this._centerItem.state] / 2;
          setAnimation(this._centerItem, time, x, y, x, y);
        }

        if (this._parentAngle != undefined) {
          const angle = this._parentAngle * Math.PI / 180;

          let x = Math.floor(Math.sin(angle) * radius) + centerX;
          let y = -Math.floor(Math.cos(angle) * radius) + centerY;
          x -= ItemSize[this._backButton.state] / 2;
          y -= ItemSize[this._backButton.state] / 2;

          setAnimation(this._backButton, time, x, y, x, y);
        } else {
          setAnimation(this._backButton, time, 0, 0, 0, 0);
        }


        if (this._restartAnimation) {

          this._restartAnimation = false;

          if (this._updateTimeout >= 0) {
            GLib.source_remove(this._updateTimeout);
            this._updateTimeout = -1;
          }

          this._updateTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 10, () => {
            const time        = GLib.get_monotonic_time() / 1000;
            const allFinished = this._updateItemPositions(time);

            if (allFinished) {
              this._updateTimeout = -1;
              return false;
            }

            return true;
          });
        }
        this._updateItemPositions(time);
      }

      updateLayout() {
        this._updateItemAngles();
        this._restartAnimation = true;
        this.queue_allocate();
      }

      add(config, where) {
        const item = this._createItem(
            config, this._inMenuOverviewMode() ? ItemState.GRID : ItemState.CHILD);

        this._selectedItem = item;
        item.button.active = true;

        this._items.splice(where, 0, item);

        this._restartAnimation = true;
        this.updateLayout();
        this.queue_allocate();
      }

      remove(which) {
        const [removed] = this._items.splice(which, 1);

        if (removed == this._selectedItem) {
          this._selectedItem = null;
        }

        removed.unparent();

        this._restartAnimation = true;
        this.updateLayout();
        this.queue_allocate();
      }

      updateSelected(config) {
        if (this._selectedItem) {
          this._selectedItem.setConfig(config);
        }
      }

      setItems(configs, selectedIndex, parentConfig, parentAngle) {
        this._hideAllItems();

        this._parentAngle = parentAngle;

        this._backButton.get_child().get_child().queue_draw();

        for (let i = 0; i < configs.length; i++) {
          const item = this._createItem(
              configs[i], parentConfig ? ItemState.CHILD : ItemState.GRID);
          this._items.push(item);

          if (i == selectedIndex) {
            this._selectedItem = item;
            item.button.active = true;
          }
        }

        if (parentConfig) {
          this._centerItem = this._createItem(parentConfig, ItemState.CENTER);

          if (selectedIndex == -1) {
            this._selectedItem             = this._centerItem;
            this._centerItem.button.active = true;
          }

          this._updateItemAngles();

        } else {
          this._centerItem = null;
        }

        this._backButton.reveal_child = parentAngle != undefined;

        this._restartAnimation = true;

        this.queue_allocate();
      }

      _createItem(config, itemState) {

        const item = new FlyPieMenuEditorItem(itemState);

        item.setConfig(config);
        item.set_parent(this);

        if (this._radioGroup) {
          item.button.set_group(this._radioGroup);
        } else {
          this._radioGroup = item.button;
        }

        if (config.type == 'CustomMenu') {
          item.editButton.connect('clicked', () => {
            this._selectedItem = item;
            this.emit('edit', this._items.indexOf(item));
          });
        }

        const dragSource =
            new Gtk.DragSource({actions: Gdk.DragAction.MOVE | Gdk.DragAction.COPY});
        dragSource.connect('prepare', (s, x, y) => {
          s.set_icon(Gtk.WidgetPaintable.new(item.getIconWidget()), x, y);

          if (item == this._centerItem) {
            return null;
          }

          return Gdk.ContentProvider.new_for_value(JSON.stringify(item.getConfig()));
        });
        dragSource.connect('drag-begin', () => {
          item.opacity   = 0.2;
          item.sensitive = false;
        });
        dragSource.connect('drag-end', (s, drag, deleteData) => {
          if (deleteData) {
            let removeIndex = this._items.indexOf(item);

            this.remove(removeIndex);
            this.emit('remove', removeIndex);

            item.opacity   = 1;
            item.sensitive = true;
          } else {
            item.opacity   = 1;
            item.sensitive = true;
          }

          this._endDrag();
        });
        dragSource.connect('drag-cancel', () => {
          item.opacity   = 1;
          item.sensitive = true;
          this._endDrag();
          return false;
        });

        item.button.add_controller(dragSource);

        const dropTarget =
            new Gtk.DropTarget({actions: Gdk.DragAction.MOVE | Gdk.DragAction.COPY});
        dropTarget.set_gtypes([GObject.TYPE_STRING]);
        dropTarget.connect(
            'accept',
            () => item.getConfig().type == 'CustomMenu' && item != this._centerItem);

        dropTarget.connect('drop', (t, what) => {
          const internalDrag = t.get_drop().get_drag() != null;
          const dropIndex    = this._items.indexOf(item);
          if (internalDrag) {
            this.emit('drop-item-into', what, dropIndex);
          } else {
            if (t.get_drop().formats.contain_mime_type('text/uri-list')) {
              what.split(/\r?\n/).forEach(line => {
                if (line != '') {
                  this.emit('drop-data-into', line, dropIndex);
                }
              });
            } else {
              this.emit('drop-data-into', what, dropIndex);
            }
          }

          this._selectedItem               = item;
          this._selectedItem.button.active = true;
          this._endDrag();
          return true;
        });

        dropTarget.connect('motion', () => Gdk.DragAction.MOVE);
        item.button.add_controller(dropTarget);

        item.button.connect('clicked', (b) => {
          // For some reason, the drag source does not work anymore once the
          // ToggleButton was toggled. Resetting the EventController seems to be a
          // working workaround.
          dragSource.reset();

          if (b.active) {
            this._selectedItem = item;
            this.emit('select', this._items.indexOf(item));
          }
        });

        return item;
      }

      _hideAllItems() {
        for (let i = 0; i < this._items.length; i++) {
          this._items[i].unparent();
        }

        if (this._centerItem) {
          this._centerItem.unparent();
        }

        this._items        = [];
        this._centerItem   = null;
        this._selectedItem = null;
      }

      // Returns true if this should show the menu grid rather than a submenu.
      _inMenuOverviewMode() {
        return this._centerItem == null;
      }

      _updateItemAngles() {
        const fixedAngles = [];

        this._items.forEach(item => {
          if (item.getConfig().angle >= 0) {
            fixedAngles.push({angle: item.getConfig().angle});
          } else {
            fixedAngles.push({});
          }
        });

        this._itemAngles = utils.computeItemAngles(fixedAngles, this._parentAngle);
      }

      // Returns true if all animations are done.
      _updateItemPositions(time) {
        let allFinished = true;

        const updateItemPosition = (item) => {
          const allocation = new Gdk.Rectangle(
              {x: 0, y: 0, width: ItemSize[item.state], height: ItemSize[item.state]});

          if (item.x && item.y) {
            allocation.x = item.x.get(time);
            allocation.y = item.y.get(time);
            allFinished &= item.x.isFinished(time);
            allFinished &= item.y.isFinished(time);
          }

          item.size_allocate(allocation, -1);
        };

        for (let i = 0; i < this._items.length; i++) {
          updateItemPosition(this._items[i]);
        }

        updateItemPosition(this._backButton);

        if (this._centerItem) {
          updateItemPosition(this._centerItem);
        }

        return allFinished;
      }

      _endDrag() {
        this._dropColumn = null;
        this._dropRow    = null;
        // this.queue_allocate();
      }
    });
  }
}