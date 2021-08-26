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
    class FlyPieMenuEditorItem extends Gtk.ToggleButton {
          // clang-format on
          _init(params = {}) {
            super._init(params);

            this.margin_top    = 4;
            this.margin_start  = 4;
            this.margin_end    = 4;
            this.margin_bottom = 4;

            // this.add_css_class('pill-button');
            this.set_has_frame(false);

            // Create the Gio.Settings object.
            this._settings = utils.createSettings();

            const box   = Gtk.Box.new(Gtk.Orientation.VERTICAL, 2);
            box.vexpand = true;
            this.set_child(box);

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
            box.append(this._nameLabel);

            this._shortcutLabel =
                new Gtk.Label({ellipsize: Pango.EllipsizeMode.MIDDLE, use_markup: true});
            this._shortcutLabel.add_css_class('caption');
            this._shortcutLabel.add_css_class('dim-label');
            box.append(this._shortcutLabel);
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

        this._buttons      = [];
        this._gridItemSize = 128;
        this._gridMode     = true;

        this._restartAnimation = false;

        this._selectedButton  = null;
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
                this._buttons.length - 1,
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


        const button = Gtk.Button.new_from_icon_name('list-add-symbolic');
        button.add_css_class('pill-button');
        button.set_has_frame(false);
        button.set_margin_start(24);
        button.set_margin_end(24);
        button.set_margin_top(24);
        button.set_margin_bottom(24);
        button.set_parent(this);

        this._buttons.push(button);

        button.connect('clicked', (b) => {
          this.emit('request-add', b.get_allocation());
        });
      }

      vfunc_get_request_mode() {
        return Gtk.SizeRequestMode.WIDTH_FOR_HEIGHT;
      }

      vfunc_measure(orientation, for_size) {
        if (this._gridMode) {
          if (orientation == Gtk.Orientation.HORIZONTAL) {
            return [this._gridItemSize * 4, this._gridItemSize * 4, -1, -1];
          }

          const columns = Math.floor(for_size / this._gridItemSize);
          const rows    = Math.ceil(this._buttons.length / columns);

          const gridSize = rows * this._gridItemSize;

          return [gridSize, gridSize, -1, -1];
        }

        return [300, 300, -1, -1];
      }

      vfunc_size_allocate(width, height, baseline) {

        if (this._buttons.length == 0) {
          return;
        }

        if (this._gridMode) {

          this._columnCount = Math.floor(width / this._gridItemSize);
          this._rowCount    = Math.ceil(this._buttons.length / this._columnCount);

          if (this._rowCount == 1) {
            this._columnCount = this._buttons.length;
          }

          this._gridOffsetX = (width - this._columnCount * this._gridItemSize) / 2;
          this._gridOffsetY = (height - this._rowCount * this._gridItemSize) / 2;

          const time = GLib.get_monotonic_time() / 1000;

          if (this._columnCount != this._lastColumnCount ||
              this._dropColumn != this._lastDropColumn ||
              this._dropRow != this._lastDropRow) {
            this._lastColumnCount  = this._columnCount;
            this._lastDropRow      = this._dropRow;
            this._lastDropColumn   = this._dropColumn;
            this._restartAnimation = true;
          }

          for (let i = 0; i < this._buttons.length; i++) {

            const column = i % this._columnCount;
            const row    = Math.floor(i / this._columnCount);

            if (this._buttons[i].x == undefined) {
              this._buttons[i].x       = new AnimatedValue();
              this._buttons[i].y       = new AnimatedValue();
              this._buttons[i].x.start = this._gridOffsetX + column * this._gridItemSize -
                  this._gridItemSize / 2;
              this._buttons[i].y.start = this._gridOffsetY + row * this._gridItemSize;
            } else {
              this._buttons[i].x.start = this._buttons[i].x.get(time);
              this._buttons[i].y.start = this._buttons[i].y.get(time);
            }

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

            this._buttons[i].x.end =
                this._gridOffsetX + column * this._gridItemSize + dropZoneOffset;
            this._buttons[i].y.end = this._gridOffsetY + row * this._gridItemSize;

            if (this._restartAnimation) {
              this._buttons[i].x.startTime = time;
              this._buttons[i].x.endTime   = time + 200;
              this._buttons[i].y.startTime = time;
              this._buttons[i].y.endTime   = time + 200;
            }
          }

          if (this._restartAnimation) {
            this._restartAnimation = false;

            if (this._updateTimeout >= 0) {
              GLib.source_remove(this._updateTimeout);
              this._updateTimeout = -1;
            }

            this._updateTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 10, () => {
              const time = GLib.get_monotonic_time() / 1000;
              this._updateGrid(time);

              if (time >= this._buttons[0].x.endTime) {
                this._updateTimeout = -1;
                return false;
              }

              return true;
            });
          }

          this._updateGrid(time);

        } else {
        }
      }

      add(config, where) {

        const button = new FlyPieMenuEditorItem();

        button.setConfig(config);
        button.set_parent(this);

        if (this._radioGroup) {
          button.set_group(this._radioGroup);
        } else {
          this._radioGroup = button;
        }

        const dragSource =
            new Gtk.DragSource({actions: Gdk.DragAction.MOVE | Gdk.DragAction.COPY});
        dragSource.connect('prepare', (s, x, y) => {
          s.set_icon(Gtk.WidgetPaintable.new(button.getIconWidget()), x, y);
          return Gdk.ContentProvider.new_for_value(JSON.stringify(button.getConfig()));
        });
        dragSource.connect('drag-begin', () => {
          button.opacity   = 0.2;
          button.sensitive = false;
        });
        dragSource.connect('drag-end', (s, drag, deleteData) => {
          if (deleteData) {
            let removeIndex = this._buttons.indexOf(button);

            if (this._dropIndex != null && this._dropIndex <= removeIndex) {
              removeIndex += 1;
            }

            this.emit('remove', removeIndex);
            button.opacity   = 1;
            button.sensitive = true;
          } else {
            button.opacity   = 1;
            button.sensitive = true;
          }

          this._endDrag();
        });
        dragSource.connect('drag-cancel', (s, drag, reason) => {
          button.opacity   = 1;
          button.sensitive = true;
          this._endDrag();
          return false;
        });

        button.add_controller(dragSource);

        const dropTarget =
            new Gtk.DropTarget({actions: Gdk.DragAction.MOVE | Gdk.DragAction.COPY});
        dropTarget.set_gtypes([GObject.TYPE_STRING]);
        dropTarget.connect('accept', (t, drop) => {
          return button.getConfig().type == 'CustomMenu';
        });
        dropTarget.connect('drop', (t, value, x, y) => {
          this.emit('add-into', value, this._buttons.indexOf(button));
          this._endDrag();
          return true;
        });
        dropTarget.connect('motion', (t, x, y) => {
          return Gdk.DragAction.MOVE;
        });
        button.add_controller(dropTarget);

        button.connect('clicked', (b) => {
          // For some reason, the drag source does not work anymore once the
          // ToggleButton was toggled. Resetting the EventController seems to be a
          // working workaround.
          dragSource.reset();

          if (b.active) {
            this._selectedButton = b;
            this.emit('select', this._buttons.indexOf(b));
          } else {
            this._selectedButton = null;
            this.emit('select', -1);
          }
        });

        this._buttons.splice(where, 0, button);

        this.queue_allocate();
      }

      remove(which) {
        const [button] = this._buttons.splice(which, 1);

        if (button == this._selectedButton) {
          this._selectedButton = null;
          this.emit('select', -1);
        }

        button.unparent();
        this._restartAnimation = true;
        this.queue_allocate();
      }

      updateSelected(config) {
        if (this._selectedButton) {
          this._selectedButton.setConfig(config);
        }
      }

      _updateGrid(time) {
        for (let i = 0; i < this._buttons.length; i++) {
          const allocation = new Gdk.Rectangle({
            x: this._buttons[i].x.get(time),
            y: this._buttons[i].y.get(time),
            width: this._gridItemSize,
            height: this._gridItemSize
          });

          this._buttons[i].size_allocate(allocation, -1);
        }
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