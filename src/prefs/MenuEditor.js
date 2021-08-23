//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const {GObject, Gtk, Gio, Gdk} = imports.gi;

const _ = imports.gettext.domain('flypie').gettext;

const Me    = imports.misc.extensionUtils.getCurrentExtension();
const utils = Me.imports.src.common.utils;

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

            // this.add_css_class('pill-button');
            // this.set_has_frame(false);

            // Create the Gio.Settings object.
            this._settings = utils.createSettings();

            const box = Gtk.Box.new(Gtk.Orientation.VERTICAL, 2);
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

            this._nameLabel = new Gtk.Label();
            this._nameLabel.add_css_class('caption-heading');
            box.append(this._nameLabel);

            this._shortcutLabel = new Gtk.Label({use_markup: true});
            this._shortcutLabel.add_css_class('dim-label');
            box.append(this._shortcutLabel);

            this._dragSource = new Gtk.DragSource();
            this._dragSource.connect('prepare', (s, x, y) => {
              s.set_icon(Gtk.WidgetPaintable.new(this._icon), x, y);
              return Gdk.ContentProvider.new_for_value('value');
            });
            this._dragSource.connect('drag-begin', () => {
              this.opacity = 0;
            });
            this._dragSource.connect('drag-end', () => {
              this.opacity = 1;
            });

            this.add_controller(this._dragSource);


            // For some reason, the drag source does not work anymore once the
            // ToggleButton was toggled. Resetting the EventController seems to be a
            // working workaround.
            this.connect('clicked', () => {
              this._dragSource.reset();
            });
          }

          setConfig(config) {
            this._config          = config;
            this._nameLabel.label = config.name;

            this._icon.queue_draw();

            if (config.shortcut) {
              const [ok, keyval, mods] = Gtk.accelerator_parse(config.shortcut);
              this._shortcutLabel.label =
                  '<small>' + Gtk.accelerator_get_label(keyval, mods) + '</small>';
            } else {
              this._shortcutLabel.label = '<small>' + _('Not Bound') + '</small>';
            }
          }
        })
  }

  if (GObject.type_from_name('FlyPieMenuEditor') == null) {
    // clang-format off
      GObject.registerClass({
        GTypeName: 'FlyPieMenuEditor',
        Signals: {
          'menu-select':  { param_types: [GObject.TYPE_INT]},
          'menu-edit':    { param_types: [GObject.TYPE_INT]},
          'menu-reorder': { param_types: [GObject.TYPE_INT, GObject.TYPE_INT]},
          'menu-delete':  { param_types: [GObject.TYPE_INT]},
          'menu-add':     { param_types: [Gdk.Rectangle.$gtype]},
        },
      },
      class FlyPieMenuEditor extends Gtk.Widget {
      // clang-format on
      _init(params = {}) {
        super._init(params);

        this._buttons        = [];
        this._selectedButton = null;

        this._menuListMode = true;
      }

      // We use a hard-coded minimum size of 500 by 500 pixels.
      vfunc_measure(orientation, for_size) {
        return [500, 500, -1, -1];
      }

      vfunc_size_allocate(width, height, baseline) {
        const labelHeight = this._infoLabel.measure(Gtk.Orientation.VERTICAL, width)[1];

        const labelAllocation = new Gdk.Rectangle(
            {x: 0, y: height - labelHeight, width: width, height: labelHeight});
        this._infoLabel.size_allocate(labelAllocation, -1);

        if (this._menuListMode) {

          // In this mode, we want to arrange the items in a centered grid layout in the
          // following fashion: At first, each item is assigned a width of 64 pixels. If
          // the available width is not sufficient to place all items in one row, we
          // split them evenly in two rows. If there's not enough space again, we split
          // all items into three rows. And so on. If the entire vertical space is
          // filled up, we start to shrink the individual items.
          const itemSize    = 128 + 4 + 4;
          const rows        = Math.ceil(this._buttons.length * itemSize / width);
          const itemsPerRow = Math.ceil(this._buttons.length / rows);

          const rowHeights = [];

          for (let r = 0; r < rows; r++) {
            let rowHeight = 0;

            for (let c = 0; c < itemsPerRow; c++) {
              const i = r * itemsPerRow + c;

              if (i < this._buttons.length) {
                rowHeight = Math.max(
                    rowHeight,
                    this._buttons[i].measure(Gtk.Orientation.VERTICAL, itemSize)[1]);
              }
            }

            rowHeights.push(rowHeight);
          }

          const gridWidth = itemsPerRow * itemSize;
          let gridHeight  = 0;

          rowHeights.forEach(height => {
            gridHeight += height;
          });


          const offsetX = Math.floor((width - gridWidth) / 2);
          const offsetY = Math.max(0, Math.floor((height - gridHeight) / 2));

          let rowStartY = offsetY;

          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < itemsPerRow; c++) {
              const i = r * itemsPerRow + c;

              if (i < this._buttons.length) {
                const allocation = new Gdk.Rectangle({
                  x: offsetX + c * itemSize,
                  y: rowStartY,
                  width: itemSize,
                  height: rowHeights[r]
                });

                this._buttons[i].size_allocate(allocation, -1);
              }
            }

            rowStartY += rowHeights[r];
          }


        } else {
        }
      }

      vfunc_realize() {
        this._infoLabel = new Gtk.Label(
            {margin_bottom: 8, justify: Gtk.Justification.CENTER, use_markup: true});
        this._infoLabel.add_css_class('dim-label');
        this._infoLabel.set_parent(this);
        super.vfunc_realize();
      }

      vfunc_unrealize() {
        this._infoLabel.unparent();
        super.vfunc_unrealize();
      }

      setConfigs(configs) {
        for (let i = 0; i < this._buttons.length; i++) {
          this._buttons[i].unparent();
        }

        this._buttons.length = 0;
        this._radioGroup     = null;

        for (let i = 0; i < configs.length; i++) {
          const button = new FlyPieMenuEditorItem({
            margin_top: 4,
            margin_bottom: 4,
            margin_start: 4,
            margin_end: 4,
            width_request: 128,
            height_request: 128,
          });

          button.setConfig(configs[i]);
          button.set_parent(this);

          if (this._radioGroup) {
            button.set_group(this._radioGroup);
          } else {
            this._radioGroup = button;
          }

          const controller = new Gtk.EventControllerMotion();
          controller.connect(
              'enter',
              () => {
                  this._infoLabel.label = _(
                      '<b>Click</b> to edit menu properties.\n<b>Double-Click</b> to edit menu items.\n<b>Drag</b> to reorder, move, or delete.')});
          controller.connect('leave', () => {this._infoLabel.label = ''});
          button.add_controller(controller);

          button.connect('clicked', (b) => {
            if (b.active) {
              this._selectedButton = b;
              this.emit('menu-select', i);
            } else {
              this._selectedButton = null;
              this.emit('menu-select', -1);
            }
          });

          this._buttons.push(button);
        }

        const button          = Gtk.Button.new_from_icon_name('list-add-symbolic');
        button.margin_top     = 4;
        button.margin_bottom  = 4;
        button.margin_start   = 4;
        button.margin_end     = 4;
        button.width_request  = 128;
        button.height_request = 128;
        button.add_css_class('pill-button');
        button.set_has_frame(false);
        button.set_parent(this);

        this._buttons.push(button);

        const controller = new Gtk.EventControllerMotion();
        controller.connect(
            'enter',
            () => {this._infoLabel.label = _('<b>Click</b> to add a new menu.')});
        controller.connect('leave', () => {this._infoLabel.label = ''});
        button.add_controller(controller);

        button.connect('clicked', (b) => {
          this.emit('menu-add', b.get_allocation());
        });


        this.queue_allocate();
      }

      updateSelected(config) {
        if (this._selectedButton) {
          this._selectedButton.setConfig(config);
        }
      }
    });
  }
}