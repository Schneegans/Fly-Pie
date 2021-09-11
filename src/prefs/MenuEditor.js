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

const TRANSITION_DURATION = 250;

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
            this.set_transition_duration(TRANSITION_DURATION);


            this.set_transition_type(Gtk.RevealerTransitionType.CROSSFADE);
            this.set_reveal_child(false);

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

        this._lastHideTime = 0;
        this._oldItems     = [];

        this._restartAnimation = false;

        this._selectedItem = null;
        this._centerItem   = null;

        this._dropIndex  = null;
        this._dragIndex  = null;
        this._dropRow    = null;
        this._dropColumn = null;

        this._dropTarget =
            new Gtk.DropTarget({actions: Gdk.DragAction.MOVE | Gdk.DragAction.COPY});
        this._dropTarget.set_gtypes([GObject.TYPE_STRING]);

        this._dropTarget.connect('accept', () => true);
        this._dropTarget.connect('leave', () => {
          // For external drag-and-drop events, 'leave' is called before 'drop'. We have
          // to reset this._dropIndex in 'leave', to make sure that the items move back to
          // their original position when the pointer leaves the drop area. However, we
          // need this._dropIndex in 'drop' to fire the 'add-item' and 'add-data' signals.
          // Therefore, we temporarily store this._dropIndex in this._lastDropIndex. This
          // is only used a few lines below in the 'drop' signal handler.
          this._lastDropIndex = this._dropIndex;

          this._dropColumn = null;
          this._dropRow    = null;
          this._dropIndex  = null;
          this.updateLayout();
        });

        this._dropTarget.connect('drop', (t, what) => {
          if (this._dropIndex == null) {
            this._dropIndex = this._lastDropIndex;
          }

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
              this._dropColumn = null;
              this._dropRow    = null;
              this._dropIndex  = null;
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
              this._dropColumn = null;
              this._dropRow    = null;
              this._dropIndex  = null;
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


          this._dropColumn = null;
          this._dropRow    = null;
          this._dropIndex  = null;

          return true;
        });

        this._dropTarget.connect('motion', (t, x, y) => {
          const lastColumnCount = this._columnCount;
          const lastDropRow     = this._dropRow;
          const lastDropColumn  = this._dropColumn;
          const lastDropIndex   = this._dropIndex;

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

            x -= this._width / 2;
            y -= this._height / 2;

            this._dropIndex = null;

            const distance = Math.sqrt(x * x + y * y);
            if (distance > ItemSize[ItemState.CENTER] / 2) {
              let mouseAngle = Math.acos(x / distance) * 180 / Math.PI;
              if (y < 0) {
                mouseAngle = 360 - mouseAngle;
              }

              // Turn 0° up.
              mouseAngle = (mouseAngle + 90) % 360;

              const itemAngles = this._computeItemAngles();

              for (let i = 0; i < itemAngles.length; i++) {
                let wedgeStart = itemAngles[i];
                let wedgeEnd   = itemAngles[(i + 1) % itemAngles.length];

                let wedgeStartPadding = 0;
                let wedgeEndPadding   = 0;

                if (this._items[i].getConfig().type == 'CustomMenu') {
                  wedgeStartPadding = 0.25;
                }

                if (this._items[(i + 1) % itemAngles.length].getConfig().type ==
                    'CustomMenu') {
                  wedgeEndPadding = 0.25;
                }

                // Wrap around.
                if (wedgeEnd < wedgeStart) {
                  wedgeEnd += 360;
                }

                const diff = wedgeEnd - wedgeStart;

                const lastWedge = i == itemAngles.length - 1 ||
                    (i == itemAngles.length - 2 &&
                     this._dragIndex == itemAngles.length - 1);

                if (lastWedge &&
                    ((mouseAngle >= wedgeStart + diff * 0.5 &&
                      mouseAngle < wedgeEnd - diff * 0.0) ||
                     (mouseAngle + 360 >= wedgeStart + diff * 0.5 &&
                      mouseAngle + 360 < wedgeEnd - diff * 0.0))) {

                  this._dropIndex = 0;
                  break;

                } else if (
                    (mouseAngle >= wedgeStart + diff * wedgeStartPadding &&
                     mouseAngle < wedgeEnd - diff * wedgeEndPadding) ||
                    (mouseAngle + 360 >= wedgeStart + diff * wedgeStartPadding &&
                     mouseAngle + 360 < wedgeEnd - diff * wedgeEndPadding)) {

                  this._dropIndex = i + 1;
                  break;
                }
              }
            }
          }

          if (this._columnCount != lastColumnCount ||
              this._dropColumn != lastDropColumn || this._dropRow != lastDropRow ||
              this._dropIndex != lastDropIndex) {
            this._restartAnimation = true;
          }

          this.queue_allocate();

          return this._dropIndex == null ? null : Gdk.DragAction.MOVE;
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

        this._width  = width;
        this._height = height;

        const setAnimation = (item, time, x, y) => {
          if (item.x == undefined) {
            item.x       = new AnimatedValue();
            item.y       = new AnimatedValue();
            item.x.start = x;
            item.y.start = y;
          } else if (this._restartAnimation) {
            item.x.start = item.x.get(time);
            item.y.start = item.y.get(time);
          }

          item.x.end = x;
          item.y.end = y;

          if (this._restartAnimation) {
            item.x.startTime = time;
            item.x.endTime   = time + TRANSITION_DURATION;
            item.y.startTime = time;
            item.y.endTime   = time + TRANSITION_DURATION;
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

            const x =
                this._gridOffsetX + column * ItemSize[ItemState.GRID] + dropZoneOffset;
            const y = this._gridOffsetY + row * ItemSize[ItemState.GRID];

            setAnimation(this._items[i], time, x, y);
          }

        } else {

          const angles = this._computeItemAngles();

          this._items.forEach((item, i) => {
            const angle = angles[i] * Math.PI / 180;
            let x       = Math.floor(Math.sin(angle) * radius) + centerX;
            let y       = -Math.floor(Math.cos(angle) * radius) + centerY;
            x -= ItemSize[item.state] / 2;
            y -= ItemSize[item.state] / 2;

            setAnimation(item, time, x, y);
          });

          let x = centerX - ItemSize[this._centerItem.state] / 2;
          let y = centerY - ItemSize[this._centerItem.state] / 2;
          setAnimation(this._centerItem, time, x, y);
        }

        if (this._parentAngle != undefined) {
          const angle = this._parentAngle * Math.PI / 180;

          let x = Math.floor(Math.sin(angle) * radius) + centerX;
          let y = -Math.floor(Math.cos(angle) * radius) + centerY;
          x -= ItemSize[this._backButton.state] / 2;
          y -= ItemSize[this._backButton.state] / 2;

          setAnimation(this._backButton, time, x, y);
        } else {

          let x = centerX - ItemSize[this._backButton.state] / 2;
          let y = centerY - ItemSize[this._backButton.state] / 2;
          setAnimation(this._backButton, time, x, y);
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
        this._restartAnimation = true;
        this.queue_allocate();
      }

      add(config, where) {
        const item = this._createItem(
            config, this._inMenuOverviewMode() ? ItemState.GRID : ItemState.CHILD);

        this._selectedItem = item;
        item.button.active = true;

        this._items.splice(where, 0, item);

        if (this._dragIndex == null) {
          this.updateLayout();
        }
      }

      remove(which) {
        const [removed] = this._items.splice(which, 1);

        if (removed == this._selectedItem) {
          this._selectedItem = null;
        }

        removed.unparent();
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

        } else {
          this._centerItem = null;
        }

        this._backButton.reveal_child = parentAngle != undefined;

        this.updateLayout();
      }

      _createItem(config, itemState) {

        const item = new FlyPieMenuEditorItem(itemState);

        item.setConfig(config);
        item.set_parent(this);
        item.set_reveal_child(true);

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
          item.opacity    = this._inMenuOverviewMode() ? 0.2 : 0.0;
          item.sensitive  = false;
          this._dragIndex = this._items.indexOf(item);
          this.updateLayout();
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


          this._dragIndex = null;
        });
        dragSource.connect('drag-cancel', () => {
          item.opacity    = 1;
          item.sensitive  = true;
          this._dragIndex = null;
          this.updateLayout();
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
          this._dropColumn                 = null;
          this._dropRow                    = null;
          this._dropIndex                  = null;
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

        const now = GLib.get_monotonic_time();
        if (this._lastHideTime + TRANSITION_DURATION < now) {
          this._oldItems.forEach(item => {
            item.unparent();
          });
          this._oldItems = [];
        }
        this._lastHideTime = now;

        this._oldItems.push(...this._items);

        if (this._centerItem) {
          this._oldItems.push(this._centerItem);
        }

        this._oldItems.forEach(item => {
          item.reveal_child = false;
          item.sensitive    = false;
        });

        this._items        = [];
        this._centerItem   = null;
        this._selectedItem = null;
      }

      // Returns true if this should show the menu grid rather than a submenu.
      _inMenuOverviewMode() {
        return this._centerItem == null;
      }

      // This computes the angles at which all current items should be drawn (only useful
      // if not in overview mode). An array of all angles is returned. The length of the
      // returned array matches this._items.length. This method will consider the fixed
      // angles of all items and will leave an angular gap according to this._parentAngle.
      // The resulting angles are the same as in the real menu.
      // As this method is also used during drag-and-drop, there are some special cases.
      // If this._dropIndex != null, there will be an additional angular gap between the
      // items at adjacent indices. If this._dragIndex != null, the corresponding item
      // (which is currently being dragged around) will receive the same angle as its
      // predecessor and all other angles will be computed as if the item did not exist.
      _computeItemAngles() {

        // This array will be passed utils.computeItemAngles() further below. For each
        // item in the menu, it should contain an empty object. If the corresponding item
        // as a fixed angle, the corresponding object in the array should contain the
        // angle as value for a property called "angle".
        const fixedAngles = [];

        // There's a special case where the drop index is before the first element - in
        // this case we have to add an artificial item to the front of the list so that
        // the angles of all other items are shifted to leave a gap for the to-be-dropped
        // item.
        if (this._dropIndex == 0) {
          fixedAngles.push({});
        }

        // Loop through all menu items.
        this._items.forEach((item, i) => {
          // If the current item is dragged around, we do not add a corresponding entry to
          // the array. This ensures that all other items behave as if the dragged item
          // did not exist.
          if (i == this._dragIndex) {
            return;
          }

          // Now we push an object for each of our menu items. This is either empty or
          // contains an "angle" property if the menu item has a fixed angle set.
          if (item.getConfig().angle >= 0) {
            fixedAngles.push({angle: item.getConfig().angle});
          } else {
            fixedAngles.push({});
          }

          // If the drop-gap is next to this item, add an artificial item after this one.
          // This will change the angles of all other items as if there was an item at
          // this position.
          if (this._dropIndex == i + 1) {
            fixedAngles.push({});
          }
        });

        const angles = utils.computeItemAngles(fixedAngles, this._parentAngle);

        // If we added an artificial item to leave an angular gap for the to-be-dropped
        // item, we have to remove this again as there os no real item at this position.
        // We only wanted to affect the angles for the adjacent items.
        if (this._dropIndex != null) {
          let removeIndex = this._dropIndex;

          if (this._dragIndex != null && this._dropIndex > this._dragIndex) {
            removeIndex -= 1;
          }

          angles.splice(removeIndex, 1);
        }

        if (this._dragIndex != null) {
          angles.splice(this._dragIndex, 0, angles[this._dragIndex % angles.length]);
        }

        return angles;
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

        this._items.forEach(updateItemPosition);
        this._oldItems.forEach(updateItemPosition);

        updateItemPosition(this._backButton);

        if (this._centerItem) {
          updateItemPosition(this._centerItem);
        }

        return allFinished;
      }
    });
  }
}