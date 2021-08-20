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
// This class loads the user interface defined in settings.ui and instantiates the      //
// classes encapsulating code for the individual pages of the preferences dialog.       //
//////////////////////////////////////////////////////////////////////////////////////////

function registerWidget() {

  if (GObject.type_from_name('FlyPieMenuEditor') == null) {
    // clang-format off
      GObject.registerClass({
        GTypeName: 'FlyPieMenuEditor',
        Signals: {
          'menu-select':  { param_types: [GObject.TYPE_INT]},
          'menu-edit':    { param_types: [GObject.TYPE_INT]},
          'menu-reorder': { param_types: [GObject.TYPE_INT, GObject.TYPE_INT]},
          'menu-delete':  { param_types: [GObject.TYPE_INT]},
          'menu-add':     {},
        },
      },
      class FlyPieMenuEditor extends Gtk.Widget {
      // clang-format on
      _init(params = {}) {
        super._init(params);

        // Create the Gio.Settings object.
        this._settings = utils.createSettings();

        this._items = [];

        this._menuListMode = true;
      }

      // We use a hard-coded minimum size of 500 pixels.
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
          const itemSize    = 128
          const rows        = Math.ceil(this._items.length * itemSize / width);
          const itemsPerRow = Math.ceil(this._items.length / rows);

          const rowHeights = [];

          for (let r = 0; r < rows; r++) {
            let rowHeight = 0;

            for (let c = 0; c < itemsPerRow; c++) {
              const i = r * itemsPerRow + c;

              if (i < this._items.length) {
                rowHeight = Math.max(
                    rowHeight,
                    this._items[i].measure(Gtk.Orientation.VERTICAL, itemSize)[1]);
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

              if (i < this._items.length) {
                const allocation = new Gdk.Rectangle({
                  x: offsetX + c * itemSize,
                  y: rowStartY,
                  width: itemSize,
                  height: rowHeights[r]
                });

                this._items[i].size_allocate(allocation, -1);
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

      setItems(items) {
        for (let i = 0; i < this._items.length; i++) {
          this._items[i].unparent();
        }

        this._items.length = 0;
        this._radioGroup   = null;

        for (let i = 0; i < items.length; i++) {
          this._appendRadioButton(items[i], (b) => {
            if (b.active) {
              this.emit('menu-select', i);
            } else {
              this.emit('menu-select', -1);
            }
          });
        }

        this._appendAddButton(() => {
          this.emit('menu-add');
        });

        this.queue_allocate();
      }

      _appendRadioButton(iconName, onClick) {
        const button = new Gtk.ToggleButton({
          margin_top: 4,
          margin_bottom: 4,
          margin_start: 4,
          margin_end: 4,
        });
        button.add_css_class('pill-button');
        button.set_has_frame(false);
        button.set_parent(this);

        if (this._radioGroup) {
          button.set_group(this._radioGroup);
        } else {
          this._radioGroup = button;
        }

        const icon = this._createIcon(iconName, 128);
        button.set_child(icon);
        this._items.push(button);

        const controller = new Gtk.EventControllerMotion();
        controller.connect(
            'enter',
            () => {
                this._infoLabel.label = _(
                    '<b>Click</b> to edit menu properties.\n<b>Double-Click</b> to edit menu items.\n<b>Drag</b> to reorder, move, or delete.')});
        controller.connect('leave', () => {this._infoLabel.label = ''});
        button.add_controller(controller);

        button.connect('clicked', onClick);
      }

      _appendAddButton(onClick) {
        const button = new Gtk.Button({
          margin_top: 4,
          margin_bottom: 4,
          margin_start: 4,
          margin_end: 4,
        });
        button.add_css_class('pill-button');
        button.set_has_frame(false);
        button.set_parent(this);

        const icon = this._createIcon('list-add-symbolic', 64);
        button.set_child(icon);
        this._items.push(button);

        const controller = new Gtk.EventControllerMotion();
        controller.connect(
            'enter',
            () => {this._infoLabel.label = _('<b>Click</b> to add a new menu.')});
        controller.connect('leave', () => {this._infoLabel.label = ''});
        button.add_controller(controller);

        button.connect('clicked', onClick);
      }

      _createIcon(iconName, size) {
        const icon = new Gtk.DrawingArea({height_request: size, width_request: size});
        icon.set_draw_func((widget, ctx) => {
          ctx.translate(
              (widget.get_allocated_width() - size) / 2,
              (widget.get_allocated_height() - size) / 2);
          const font  = this._settings.get_string('font');
          const color = widget.get_style_context().get_color();
          utils.paintIcon(ctx, iconName, size, 1, font, color);
          return false;
        });

        return icon;
      }
    });
  }
}