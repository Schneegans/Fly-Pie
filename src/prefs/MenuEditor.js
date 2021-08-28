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
const AnimatedValue = Me.imports.src.prefs.AnimatedValue.AnimatedValue;

//////////////////////////////////////////////////////////////////////////////////////////
// This is the canvas where the editable menu is drawn to. It's a custom container      //
// widget and we use standard widgets such as GtkLabels and GtkButtons to draw the      //
// menu.                                                                                //
//////////////////////////////////////////////////////////////////////////////////////////

let FlyPieMenuEditorItem;

function registerWidget() {

  if (GObject.type_from_name('FlyPieMenuEditorItem') == null) {
    // clang-format off
    FlyPieMenuEditorItem = GObject.registerClass({
      GTypeName: 'FlyPieMenuEditorItem',
    },
    class FlyPieMenuEditorItem extends Gtk.Revealer {
          // clang-format on
          _init(params = {}) {
            super._init(params);

            this.button = new Gtk.ToggleButton({
              margin_top: 4,
              margin_start: 4,
              margin_end: 4,
              margin_bottom: 4,
              has_frame: false
            });

            this.set_transition_type(Gtk.RevealerTransitionType.CROSSFADE);
            this.set_reveal_child(true);
            this.set_child(this.button);

            // Create the Gio.Settings object.
            this._settings = utils.createSettings();

            const box = Gtk.Box.new(Gtk.Orientation.VERTICAL, 2);

            box.vexpand = true;
            this.button.set_child(box);

            this._iconName = 'image-missing';

            this._icon = new Gtk.DrawingArea({hexpand: true, vexpand: true});
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
            box.append(this._icon);

            this._nameLabel = new Gtk.Label({ellipsize: Pango.EllipsizeMode.MIDDLE});
            this._nameLabel.add_css_class('caption-heading');

            this.nameRevealer = new Gtk.Revealer({
              transition_type: Gtk.RevealerTransitionType.SLIDE_UP,
              reveal_child: true
            });
            this.nameRevealer.set_child(this._nameLabel);

            box.append(this.nameRevealer);

            this._shortcutLabel =
                new Gtk.Label({ellipsize: Pango.EllipsizeMode.MIDDLE, use_markup: true});
            this._shortcutLabel.add_css_class('caption');
            this._shortcutLabel.add_css_class('dim-label');

            this.shortcutRevealer = new Gtk.Revealer({
              transition_type: Gtk.RevealerTransitionType.SLIDE_UP,
              reveal_child: true
            });
            this.shortcutRevealer.set_child(this._shortcutLabel);

            box.append(this.shortcutRevealer);
          }

          setConfig(config) {
            this._config          = config;
            this._nameLabel.label = config.name;

            this._icon.queue_draw();

            if (config.shortcut) {
              const [ok, keyval, mods]  = Gtk.accelerator_parse(config.shortcut);
              this._shortcutLabel.label = Gtk.accelerator_get_label(keyval, mods);
            } else {
              this._shortcutLabel.label = _('Not Bound');
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
          'select':      { param_types: [GObject.TYPE_INT]},
          'edit':        { param_types: [GObject.TYPE_INT]},
          'remove':      { param_types: [GObject.TYPE_INT]},
          'add':         { param_types: [GObject.TYPE_STRING, GObject.TYPE_INT]},
          'add-into':    { param_types: [GObject.TYPE_STRING, GObject.TYPE_INT]},
          'request-add': { param_types: [Gdk.Rectangle.$gtype]},
        },
      },
      class FlyPieMenuEditor extends Gtk.Widget {
      // clang-format on
      _init(params = {}) {
        super._init(params);

        this._items        = [[]];
        this._gridItemSize = 128;

        this._restartAnimation = false;

        this._selectedItem = null;
        this._parentItem   = null;

        this._lastColumnCount = null;
        this._lastDropColumn  = null;
        this._lastDropRow     = null;

        this._dropIndex  = null;
        this._dropRow    = null;
        this._dropColumn = null;

        this._dropTarget =
            new Gtk.DropTarget({actions: Gdk.DragAction.MOVE | Gdk.DragAction.COPY});
        this._dropTarget.set_gtypes([GObject.TYPE_STRING]);

        this._dropTarget.connect('accept', (t, drop) => {
          return true;
        });

        this._dropTarget.connect('leave', () => {
          this._endDrag();
        });

        this._dropTarget.connect('drop', (t, value, x, y) => {
          if (this._dropIndex == null) {
            return false;
          }
          this.emit('add', value, this._dropIndex);
          this._dropColumn = null;
          this._dropRow    = null;
          this.queue_allocate();
          return true;
        });

        this._dropTarget.connect('motion', (t, x, y) => {
          x -= this._gridOffsetX;
          y -= this._gridOffsetY;

          x = Math.max(0, Math.min(this._columnCount * this._gridItemSize, x));
          y = Math.max(0, Math.min(this._rowCount * this._gridItemSize, y));

          const dropZoneWidth = this._gridItemSize / 4;

          if (x % this._gridItemSize < dropZoneWidth ||
              x % this._gridItemSize > this._gridItemSize - dropZoneWidth) {
            this._dropColumn = Math.floor(x / this._gridItemSize + 0.5);
            this._dropRow    = Math.floor(y / this._gridItemSize);
            this._dropIndex  = Math.min(
                this._items[0].length - 1,
                this._columnCount * this._dropRow + this._dropColumn);
          } else {
            this._dropColumn = null;
            this._dropRow    = null;
            this._dropIndex  = null;
          }

          this.queue_allocate();

          return Gdk.DragAction.MOVE;
        });

        this.add_controller(this._dropTarget);

        const revealer = new Gtk.Revealer(
            {transition_type: Gtk.RevealerTransitionType.CROSSFADE, reveal_child: true});
        revealer.set_parent(this);

        const button = Gtk.Button.new_from_icon_name('list-add-symbolic');
        button.add_css_class('pill-button');
        button.set_has_frame(false);
        button.set_margin_start(24);
        button.set_margin_end(24);
        button.set_margin_top(24);
        button.set_margin_bottom(24);
        revealer.set_child(button);

        this._items[0].push(revealer);

        button.connect('clicked', () => {
          this.emit('request-add', revealer.get_allocation());
        });
      }

      vfunc_get_request_mode() {
        return Gtk.SizeRequestMode.WIDTH_FOR_HEIGHT;
      }

      vfunc_measure(orientation, for_size) {
        if (this._inMenuOverviewMode()) {
          if (orientation == Gtk.Orientation.HORIZONTAL) {
            return [this._gridItemSize * 4, this._gridItemSize * 4, -1, -1];
          }

          const columns = Math.floor(for_size / this._gridItemSize);
          const rows    = Math.ceil(this._items[0].length / columns);

          const gridSize = rows * this._gridItemSize;

          return [gridSize, gridSize, -1, -1];
        }

        return [this._gridItemSize * 4, this._gridItemSize * 4, -1, -1];
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

        if (this._items.length == 0) {
          return;
        }

        const time  = GLib.get_monotonic_time() / 1000;
        const items = this._getCurrentItems();

        if (this._inMenuOverviewMode()) {

          if (items.length == 0) {
            return;
          }

          this._columnCount = Math.floor(width / this._gridItemSize);
          this._rowCount    = Math.ceil(items.length / this._columnCount);

          if (this._rowCount == 1) {
            this._columnCount = items.length;
          }

          this._gridOffsetX = (width - this._columnCount * this._gridItemSize) / 2;
          this._gridOffsetY = (height - this._rowCount * this._gridItemSize) / 2;

          if (this._columnCount != this._lastColumnCount ||
              this._dropColumn != this._lastDropColumn ||
              this._dropRow != this._lastDropRow) {
            this._lastColumnCount  = this._columnCount;
            this._lastDropRow      = this._dropRow;
            this._lastDropColumn   = this._dropColumn;
            this._restartAnimation = true;
          }

          for (let i = 0; i < items.length; i++) {

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

            const startX =
                this._gridOffsetX + column * this._gridItemSize - this._gridItemSize / 2;
            const startY = this._gridOffsetY + row * this._gridItemSize;
            const endX = this._gridOffsetX + column * this._gridItemSize + dropZoneOffset;
            const endY = this._gridOffsetY + row * this._gridItemSize;

            setAnimation(items[i], time, startX, startY, endX, endY);
          }

        } else {
          const items = this._getCurrentItems();

          for (let i = 0; i < items.length; i++) {
            // arrange in circle
          }

          const centerX = (width - this._gridItemSize) / 2;
          const centerY = (height - this._gridItemSize) / 2;

          setAnimation(this._parentItem, time, centerX, centerY, centerX, centerY);
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

      add(config, where) {

        const item = new FlyPieMenuEditorItem();

        item.setConfig(config);
        item.set_parent(this);

        if (this._radioGroup) {
          item.button.set_group(this._radioGroup);
        } else {
          this._radioGroup = item.button;
        }

        const longPress = new Gtk.GestureLongPress();
        longPress.connect('pressed', () => {
          if (item.getConfig().type == 'CustomMenu') {
            this._selectedItem = item;
            this.emit('edit', this._getCurrentItems().indexOf(item));
          }
        });
        item.button.add_controller(longPress);

        const dragSource =
            new Gtk.DragSource({actions: Gdk.DragAction.MOVE | Gdk.DragAction.COPY});
        dragSource.connect('prepare', (s, x, y) => {
          s.set_icon(Gtk.WidgetPaintable.new(item.getIconWidget()), x, y);

          if (item == this._parentItem) {
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
            let removeIndex = this._getCurrentItems().indexOf(item);

            if (this._dropIndex != null && this._dropIndex <= removeIndex) {
              removeIndex += 1;
            }

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
        dropTarget.connect('accept', () => item.getConfig().type == 'CustomMenu');
        dropTarget.connect('drop', (t, value) => {
          this.emit('add-into', value, this._getCurrentItems().indexOf(item));
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
          longPress.reset();

          if (b.active) {
            this._selectedItem = item;
            this.emit('select', this._getCurrentItems().indexOf(item));
          }
        });

        // item.button.emit('activate');

        this._getCurrentItems().splice(where, 0, item);
        this.queue_allocate();
      }

      remove(which) {
        const items     = this._getCurrentItems();
        const [removed] = items.splice(which, 1);

        if (removed == this._selectedItem) {
          this._selectedItem = null;
        }

        removed.unparent();
        this._restartAnimation = true;
        this.queue_allocate();
      }

      updateSelected(config) {
        if (this._selectedItem) {
          this._selectedItem.setConfig(config);
        }
      }

      // hide toplevels, hide & delete sublevels, move center
      navigateInto(parentIndex) {
        const items = this._getCurrentItems();

        for (let i = 0; i < items.length; i++) {
          if (i == parentIndex) {
            items[i].nameRevealer.reveal_child     = false;
            items[i].shortcutRevealer.reveal_child = false;
            items[i].button.add_css_class('pill-button');
          } else {
            items[i].reveal_child = false;
          }
        }


        this._parentItem = items[parentIndex];
        this._items.push([]);

        this._restartAnimation = true;

        this.queue_allocate();
      }

      // navigateBack(parentIndex) {
      //   if (parentIndex >= 0) {
      //     this._parentItem
      //   }
      // }

      _getCurrentItems() {
        return this._items[this._items.length - 1];
      }

      // Returns true if this should show the menu grid rather than a submenu.
      _inMenuOverviewMode() {
        return this._items.length == 1;
      }

      // Returns true if all animations are done.
      _updateItemPositions(time) {
        let allFinished = true;

        for (let i = 0; i < this._items.length; i++) {
          for (let j = 0; j < this._items[i].length; j++) {
            const allocation = new Gdk.Rectangle({
              x: this._items[i][j].x.get(time),
              y: this._items[i][j].y.get(time),
              width: this._gridItemSize,
              height: this._gridItemSize
            });

            allFinished &= this._items[i][j].x.isFinished(time);
            allFinished &= this._items[i][j].y.isFinished(time);

            this._items[i][j].size_allocate(allocation, -1);
          }
        }

        return allFinished;
      }

      _endDrag() {
        this._dropColumn = null;
        this._dropRow    = null;
        this._dropIndex  = null;
        this.queue_allocate();
      }
    });
  }
}