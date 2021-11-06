//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const {GLib, GObject, Gtk, Gdk, Pango} = imports.gi;
const ByteArray                        = imports.byteArray;

const _ = imports.gettext.domain('flypie').gettext;

const Me                 = imports.misc.extensionUtils.getCurrentExtension();
const utils              = Me.imports.src.common.utils;
const ItemRegistry       = Me.imports.src.common.ItemRegistry.ItemRegistry;
const ItemClass          = Me.imports.src.common.ItemRegistry.ItemClass;
const AnimatedValue      = Me.imports.src.prefs.AnimatedValue.AnimatedValue;
const AnimationDirection = Me.imports.src.prefs.AnimatedValue.AnimationDirection;

//////////////////////////////////////////////////////////////////////////////////////////
// The menu editor is the canvas where the menu overview or the editable menu is drawn  //
// to. It's a custom container widget and we use standard widgets such as GtkLabels and //
// GtkButtons to draw the menu. The path-bar at the top and the stash- / trash-bar at   //
// the bottom are not part of this widget, they are defined in the UI file and managed  //
// by the MenuEditorPage.                                                               //
//                                                                                      //
// Besides some constants, this file defines one function (registerWidgets()) which     //
// registers two widgets which are later instantiated by a Gtk.Builder. See the         //
// documentation of the classes below for more details.                                 //
//////////////////////////////////////////////////////////////////////////////////////////

// Each menu item which is displayed in the menu editor will have a 'state' property which
// is set to one of these three states. GRID items are shown in the overview, one CENTER
// and several CHILD items are shown when a menu is currently edited.
const ItemState = {
  GRID: 0,
  CENTER: 1,
  CHILD: 2
};

// Menu items are allocated to have one of these sizes, based on their ItemState.
const ItemSize = [130, 120, 100];

// When a new set of menu items is provided via the setItems() method of the
// FlyPieMenuEditor, an animated transition is made. There are three different transitions
// and which is used is based on the menu level which is currently displayed and the menu
// level which will be displayed next. The scheme below shows which transitions are used
// when:
//
//                                    ,----------------------,
//   ,---------------------------->   |  Menu Overview Mode  |
//   |                                '----------------------'
//   |                                         |   ^
//   |                   A: Fade in new items  |   |  A: Fade in new items
//   |                                         V   |
//   |                                ,----------------------,
//   | A: Fade in new items           |    Top-level Menu    |
//   |                                '----------------------'
//   |                                         |   ^
//   |          B: Fade in new items and move  |   |  C: Fade in new items and move
//   |              them a little bit towards  |   |     them a little bit towards
//   |                the **new** parentAngle  |   |     the **old** parentAngle
//   |                                         V   |
//   |                                ,----------------------,
//   |'----------------------------   |    Submenu Level n   |
//   |                                '----------------------'
//   |                                         |   ^
//   |                          Same as above  |   |  Same as above
//   |                                         V   |
//   |                                ,----------------------,
//   '-----------------------------   |   Submenu Level n+1  |
//                                    '----------------------'
const TransitionType = {
  NONE: 0,
  TRANSITION_A: 1,
  TRANSITION_B: 2,
  TRANSITION_C: 3
};

// This is used for most animations / transitions in the menu editor.
const TRANSITION_DURATION = 350;


// The widget itself is instantiated by the Gtk.Builder, here we only register the GObject
// type. This method is called by the constructor of the PreferencesDialog.
function registerWidgets() {
  let FlyPieMenuEditorItem;
  let FlyPieMenuEditorBase;

  ////////////////////////////////////////////////////////////////////////////////////////
  // Instances of this class are used to draw the individual menu items in the menu     //
  // editor. Based on the given ItemState, they consist of different widgets; for       //
  // instance items of type GRID will show the menu shortcut while CENTER items will    //
  // only show a label.                                                                 //
  // FlyPieMenuEditorItem is derived from Gtk.Revealer so that we can easily show or    //
  // hide the items with a nice fading transition. It has some publicly accessible      //
  // members such as the 'button' which is the Gtk.ToggleButton (which is used to make  //
  // the items selectable), the 'editButton' (which is only visible for items of        //
  // type 'CustomMenu'), or the 'icon' which is a Gtk.DrawingArea. Two other important  //
  // public properties are 'x' and 'y' which are AnimatedValues which are use for       //
  // smooth re-positioning of the item.                                                 //
  ////////////////////////////////////////////////////////////////////////////////////////

  if (GObject.type_from_name('FlyPieMenuEditorItem') == null) {
    // clang-format off
    FlyPieMenuEditorItem = GObject.registerClass({
      GTypeName: 'FlyPieMenuEditorItem',
    },
    class FlyPieMenuEditorItem extends Gtk.Revealer {
          // clang-format on

          // ---------------------------------------------------- constructor / destructor

          // Creates a new FlyPieMenuEditorItem based on the given state.
          _init(itemState) {
            super._init({});

            // Store the given state.
            this.state = itemState;

            // Create a Gio.Settings object. This is required to use the correct font when
            // drawing a text icon.
            this._settings = utils.createSettings();

            // Setup the revealer properties. Initially, we hide all contained widgets so
            // that they can be shown with a fade-in animation.
            this.set_transition_duration(TRANSITION_DURATION);
            this.set_transition_type(Gtk.RevealerTransitionType.CROSSFADE);
            this.set_reveal_child(false);

            // We use a Gtk.Overlay for the edit-button. This is actually only required
            // for items of type 'CustomMenu' but we create it anyways.
            const overlay = new Gtk.Overlay();
            utils.setChild(this, overlay);

            // Create the main toggle button which makes the item selectable. We do not
            // add this to a container yet, as where this is appended depends on the given
            // state. This is done further below.
            if (utils.gtk4()) {
              this.button = new Gtk.ToggleButton({
                margin_top: 5,
                margin_start: 5,
                margin_end: 5,
                margin_bottom: 5,
                has_frame: false
              });
            } else {
              this.button = new Gtk.RadioButton({
                margin_top: 5,
                margin_start: 5,
                margin_end: 5,
                margin_bottom: 5,
                relief: Gtk.ReliefStyle.NONE,
                draw_indicator: false
              });
            }

            utils.addCSSClass(this.button, 'round-button');

            // Each item has an icon. THis is drawn using a GtkDrawingArea. Again, we do
            // not add this to a container yet, as where this is appended depends on the
            // given state. This is done further below.
            this.icon = new Gtk.DrawingArea({hexpand: true, vexpand: true});
            utils.setDrawFunc(this.icon, (widget, ctx) => {
              const size =
                  Math.min(widget.get_allocated_width(), widget.get_allocated_height());
              ctx.translate(
                  (widget.get_allocated_width() - size) / 2,
                  (widget.get_allocated_height() - size) / 2);
              const font  = this._settings.get_string('font');
              const color = utils.getColor(widget);
              utils.paintIcon(ctx, this._config.icon, size, 1, font, color);
              return false;
            });

            // Center icons have a bit more margin.
            if (itemState == ItemState.CENTER) {
              this.icon.margin_top    = 3;
              this.icon.margin_start  = 3;
              this.icon.margin_end    = 3;
              this.icon.margin_bottom = 3;
            }

            // Only child an overview items have a caption.
            if (itemState == ItemState.GRID || itemState == ItemState.CHILD) {
              this._nameLabel = new Gtk.Label({ellipsize: Pango.EllipsizeMode.END});
              utils.addCSSClass(this._nameLabel, 'caption-heading');
            }

            // The shortcut label is only required for the menu mode.
            if (itemState == ItemState.GRID) {
              this._shortcutLabel =
                  new Gtk.Label({ellipsize: Pango.EllipsizeMode.END, use_markup: true});
              utils.addCSSClass(this._shortcutLabel, 'caption');
              utils.addCSSClass(this._shortcutLabel, 'dim-label');
            }

            // Now that all required widgets are set up, we add the to some containers.

            // In the menu overview mode, we use a vertical Gtk.Box to layout the icon,
            // the name label and the shortcut label.
            if (itemState == ItemState.GRID) {
              const box   = Gtk.Box.new(Gtk.Orientation.VERTICAL, 2);
              box.vexpand = true;
              utils.boxAppend(box, this.icon, false, true);
              utils.boxAppend(box, this._nameLabel);
              utils.boxAppend(box, this._shortcutLabel);

              utils.setChild(this.button, box);
              utils.setChild(overlay, this.button);
            }

            // For the center item, the icon is directly add to the toggle button.
            if (itemState == ItemState.CENTER) {
              utils.setChild(overlay, this.button);
              utils.setChild(this.button, this.icon, false, true);
            }

            // Child items are similar to grid items but do not contain a shortcut label.
            if (itemState == ItemState.CHILD) {
              const box   = Gtk.Box.new(Gtk.Orientation.VERTICAL, 2);
              box.vexpand = true;
              utils.boxAppend(box, this.icon, false, true);
              utils.boxAppend(box, this._nameLabel);

              utils.setChild(this.button, box);
              utils.setChild(overlay, this.button);
            }

            // Create the edit button.
            if (utils.gtk4()) {
              this.editButton =
                  Gtk.Button.new_from_icon_name('flypie-custom-menu-symbolic');
            } else {
              this.editButton = Gtk.Button.new_from_icon_name(
                  'flypie-custom-menu-symbolic', Gtk.IconSize.BUTTON);
              this.editButton.no_show_all = true;
            }

            utils.addCSSClass(this.editButton, 'pill-button');
            this.editButton.valign = Gtk.Align.START;
            this.editButton.halign = Gtk.Align.END;
            overlay.add_overlay(this.editButton);
          }

          // ------------------------------------------------------------ public interface

          // Sets the text of the contained Gtk.Labels and the icon according to the
          // values provided by the config object. This should have a 'type', 'name',
          // 'shortcut', and 'icon' property.
          setConfig(config) {

            // Store the given config.
            this._config = config;

            // Show the edit button if the item is a custom menu.
            this.editButton.visible =
                this.state != ItemState.CENTER && config.type == 'CustomMenu';

            // Update the icon.
            this.icon.queue_draw();

            // Update the caption of menu overview items and child items.
            if (this._nameLabel) {
              this._nameLabel.label = config.name;
            }

            // Update the shortcut label of menu overview items.
            if (this._shortcutLabel) {
              if (config.shortcut) {
                if (utils.gtk4()) {
                  const [ok, keyval, mods]  = Gtk.accelerator_parse(config.shortcut);
                  this._shortcutLabel.label = Gtk.accelerator_get_label(keyval, mods);
                } else {
                  const [keyval, mods]      = Gtk.accelerator_parse(config.shortcut);
                  this._shortcutLabel.label = Gtk.accelerator_get_label(keyval, mods);
                }
              } else {
                this._shortcutLabel.label = _('Not Bound');
              }
            }
          }

          // Returns the config last set with setConfig().
          getConfig() {
            return this._config;
          }
        })
  }

  ////////////////////////////////////////////////////////////////////////////////////////
  // The FlyPieMenuEditor maintains a list of FlyPieMenuEditorItems and layouts them in //
  // a specific manner. There are basically two display modes - first the menu overview //
  // mode where the items are drawn in a grid, and second the menu edit mode where the  //
  // items are drawn in a circular fashion. Whenever the user interacts with the items  //
  // (e.g. select, drag-and-drop) signals are emitted.                                  //
  ////////////////////////////////////////////////////////////////////////////////////////

  if (GObject.type_from_name('FlyPieMenuEditorBase') == null) {

    // To support both, GTK3 and GTK4 from the same codebase, some weird things have to be
    // done here. On GTK4, everything is fine but creating a custom container widget on
    // GTK3 is ... challenging. Therefore, the FlyPieMenuEditor is derived from Gtk.Widget
    // on GTK4 and from Gtk.Fixed on GTK3 (hacky, but possible).
    // There are also different abstract methods which need to be overridden on GTK43 /
    // GTK4. Therefore there is a main FlyPieMenuEditorBase class and derived therefrom
    // different FlyPieMenuEditor's on GTK3 / GTK4. So it looks a bit like this:
    //
    //                    GTK3                                    GTK4
    //
    //          ,----------------------,                ,----------------------,
    //          |      Gtk.Fixed       |                |     Gtk.Widget       |
    //          '----------------------'                '----------------------'
    //                      ^                                       ^
    //                      |                                       |
    //          ,--------------------------------------------------------------,
    //          |                     FlyPieMenuEditorBase                     |
    //          '--------------------------------------------------------------'
    //                      ^                                       ^
    //                      |                                       |
    //    ,---------------------------------,      ,---------------------------------,
    //    | FlyPieMenuEditor (GTK3 Version) |      | FlyPieMenuEditor (GTK4 Version) |
    //    '---------------------------------'      '---------------------------------'
    //
    const BASE_CLASS = utils.gtk4() ? Gtk.Widget : Gtk.Fixed;

    // clang-format off
    FlyPieMenuEditorBase = GObject.registerClass({
        GTypeName: 'FlyPieMenuEditorBase',
        Signals: {
          // Emitted whenever an item got selected by the user. The index of the selected
          // item is passed as parameter.
          'select-item': { param_types: [GObject.TYPE_INT]},
          
          // Emitted whenever the edit-button of an item got clicked by the user. The
          // index of the to-be-edited item is passed as parameter.
          'edit-item': { param_types: [GObject.TYPE_INT]},

          // Emitted whenever an item got deleted (usually due to an ending drag-and-drop
          // operation). It is not necessary to call the remove() method in response; the
          // item will be removed automatically.
          // The index of the deleted item is passed as parameter.
          'remove-item': { param_types: [GObject.TYPE_INT]},

          // Emitted whenever a new item should be created because of a successful
          // internal drag-and-dop operation. A JSON representation of the dropped item
          // and the drop location are passed as parameters. When a new item could be
          // constructed based on the provided data, call add() in response.
          'drop-item': { param_types: [GObject.TYPE_STRING, GObject.TYPE_INT]},

          // Emitted whenever a new item should be created because of a successful
          // external drag-and-dop operation. A text representation of the dropped data
          // (usually an URI) and the drop location are passed as parameters. When a new
          // item could be constructed based on the provided data, call add() in response.
          'drop-data': { param_types: [GObject.TYPE_STRING, GObject.TYPE_INT]},

          // Emitted whenever a new item should be created because of a successful
          // internal drag-and-dop operation. A JSON representation of the dropped item
          // and the index of the item into which the dragged item was dropped are passed
          // as parameters. When a new item could be constructed based on the provided
          // data, call add() in response.
          'drop-item-into': { param_types: [GObject.TYPE_STRING, GObject.TYPE_INT]},

          // Emitted whenever a new item should be created because of a successful
          // external drag-and-dop operation. A text representation of the dropped data
          // (usually an URI) and the index of the item into which the dragged data was
          // dropped are passed as parameters. When a new item could be constructed based
          // on the provided data, call add() in response.
          'drop-data-into': { param_types: [GObject.TYPE_STRING, GObject.TYPE_INT]},

          // Emitted whenever the back-button is clicked.
          'go-back': { param_types: []},

          // Emitted whenever a notification should be shown to the user.
          'notification': { param_types: [GObject.TYPE_STRING]},
        },
      },
      class FlyPieMenuEditor extends BASE_CLASS {
      // clang-format on

      // -------------------------------------------------------- constructor / destructor

      // Creates a new FlyPieMenuEditor. This is derived from Gtk.Widget - standard widget
      // properties can be passed as parameters.
      _init(params = {}) {
        super._init(params);

        // Create a Gio.Settings object. This is required to use the correct font when
        // drawing a text icon.
        this._settings = utils.createSettings();

        // This list contains all currently visible items. The only exception are the
        // _centerItem and the _backButton which are not in this list but managed
        // separately.
        this._items      = [];
        this._centerItem = null;

        // This stores a reference to the currently selected item.
        this._selectedItem = null;

        // When this is set to true, vfunc_size_allocate() will be called repeatedly for
        // the TRANSITION_DURATION.
        this._restartAnimation = false;

        // These are set during setItems() and are evaluated in the next
        // vfunc_size_allocate() to move the items around accordingly.
        this._upcomingTransition = TransitionType.NONE;
        this._transitionAngle    = 0;

        // Here we create the icon and label which are shown if no menu is present.
        {
          const icon =
              new Gtk.Image({icon_name: 'face-crying-symbolic', pixel_size: 128});
          const label = new Gtk.Label({label: _('No menus configured')});
          utils.addCSSClass(label, 'title-3');
          const description = new Gtk.Label(
              {label: _('Create a new menu with the button in the top right corner.')});
          utils.addCSSClass(description, 'caption');

          this._ifEmptyHint           = Gtk.Box.new(Gtk.Orientation.VERTICAL, 4);
          this._ifEmptyHint.vexpand   = true;
          this._ifEmptyHint.valign    = Gtk.Align.CENTER;
          this._ifEmptyHint.sensitive = false;
          utils.boxAppend(this._ifEmptyHint, icon);
          utils.boxAppend(this._ifEmptyHint, label);
          utils.boxAppend(this._ifEmptyHint, description);

          // The MenuEditor is derived from Gtk.Fixed on GTK3 and from Gtk.Widget on GTK4.
          // So we have add child items differently.
          if (utils.gtk4()) {
            this._ifEmptyHint.set_parent(this);
          } else {
            this.put(this._ifEmptyHint, 0, 0);
          }
        }

        // Here we create the icon and label which are shown to highlight the add-new-item
        // button.
        {
          let icon;
          if (utils.gtk4()) {
            icon = Gtk.Image.new_from_icon_name('flypie-arrow-up-symbolic');
          } else {
            icon = Gtk.Image.new_from_icon_name(
                'flypie-arrow-up-symbolic', Gtk.IconSize.BUTTON);
          }
          const label = new Gtk.Label({label: _('Add a new item')});
          utils.addCSSClass(label, 'caption');

          this._addItemHint            = Gtk.Box.new(Gtk.Orientation.HORIZONTAL, 4);
          this._addItemHint.hexpand    = true;
          this._addItemHint.halign     = Gtk.Align.END;
          this._addItemHint.valign     = Gtk.Align.START;
          this._addItemHint.sensitive  = false;
          this._addItemHint.margin_end = 20;
          this._addItemHint.margin_top = 8;
          utils.boxAppend(this._addItemHint, label);
          utils.boxAppend(this._addItemHint, icon);

          // The MenuEditor is derived from Gtk.Fixed on GTK3 and from Gtk.Widget on GTK4.
          // So we have add child items differently.
          if (utils.gtk4()) {
            this._addItemHint.set_parent(this);
          } else {
            this.put(this._addItemHint, 0, 0);
          }
        }

        // Now we set up the back-navigation button which is shown whenever we are in a
        // submenu.
        {
          this._backButton = new Gtk.Button({
            margin_start: 20,
            margin_end: 20,
            margin_top: 20,
            margin_bottom: 20,
          });
          utils.addCSSClass(this._backButton, 'pill-button');
          this._backButton.connect('clicked', (b) => {
            // Navigate to the previous level when clicked.
            this.emit('go-back');
          });

          // Assign a state so that it gets scaled like the other child buttons.
          this._backButton.state = ItemState.CHILD;

          // As the arrow on the back-button should be rotated in the parent direction, we
          // use a custom Gtk.DrawingArea.
          const icon = new Gtk.DrawingArea({
            margin_start: 10,
            margin_end: 10,
            margin_top: 10,
            margin_bottom: 10,
          });

          utils.setDrawFunc(icon, (widget, ctx) => {
            const width  = widget.get_allocated_width();
            const height = widget.get_allocated_height();
            const size   = Math.min(width, height);
            if (this._parentAngle >= 0) {
              ctx.translate(width / 2, height / 2);
              ctx.rotate((this._parentAngle + 90) * Math.PI / 180);
              ctx.translate(-width / 2, -height / 2);
            }
            ctx.translate((width - size) / 2, (height - size) / 2);
            const color = utils.getColor(widget);
            utils.paintIcon(ctx, 'go-previous-symbolic', size, 1, 'Sans', color);

            return false;
          });

          utils.setChild(this._backButton, icon);

          // The MenuEditor is derived from Gtk.Fixed on GTK3 and from Gtk.Widget on GTK4.
          // So we have add child items differently.
          if (utils.gtk4()) {
            this._backButton.set_parent(this);
          } else {
            this.put(this._backButton, 0, 0);

            // Make sure that the button is not shown automatically.
            this._backButton.no_show_all = true;
            icon.visible                 = true;
          }
        }

        // The entire menu editor is a drop target. This is used both for internal
        // drag-and-drop of menu items and external drops for item creation based on URLs
        // etc. Setting up drag and drop is quite different on GTK3 / GTK4. Therefore this
        // code looks a bit more difficult than it actually is. There are a few lambdas
        // involved which are then connected to the various signals of the widget (GTK3)
        // or the EventController (GTK4).
        {

          // On GTK3, we need special drag and drop targets.
          if (!utils.gtk4()) {
            this._dndTargets = [
              Gtk.TargetEntry.new('FLY-PIE-ITEM', Gtk.TargetFlags.SAME_APP, 0),
              Gtk.TargetEntry.new('text/uri-list', 0, 1),
              Gtk.TargetEntry.new('text/plain', 0, 2),
            ];
          }

          // The index of the dragged item.
          this._dragIndex = null;

          // The index where the dragged item will be placed if dropped.
          this._dropIndex = null;

          // In menu overview mode, these will contain the row and column where the
          // dragged thing will end up when dropped.
          this._dropRow    = null;
          this._dropColumn = null;

          // When the user drags something across the widget, we re-arrange all items to
          // visually show where the new item would be created if dropped. In this
          // 'motion' callback, we compute the index where the data is supposed to be
          // dropped. The actual item positioning is later done in vfunc_size_allocate()
          // based on the computed index.
          const dragMotion = (x, y) => {
            // If any of the below values changes during this callback, we will trigger
            // an animation so that items move around smoothly.
            const lastDropRow    = this._dropRow;
            const lastDropColumn = this._dropColumn;
            const lastDropIndex  = this._dropIndex;

            // Computing the _dropIndex in menu overview mode is rather simple as we
            // just have to compute the row and column the pointer resides currently
            // over.
            if (this._inMenuOverviewMode()) {

              // The grid is drawn centered. Here we make the coordinates relative to
              // the grid and clamp the coordinates to the grid bounds.
              x -= this._gridOffsetX;
              y -= this._gridOffsetY;
              x = Math.max(0, Math.min(this._columnCount * ItemSize[ItemState.GRID], x));
              y = Math.max(0, Math.min(this._rowCount * ItemSize[ItemState.GRID], y));

              // To allow for drops into items, the valid drop zones are between two
              // items with a total width of half an item (one quarter from the one item
              // and a quarter of the next item).
              const dropZoneWidth = ItemSize[ItemState.GRID] / 4;

              // Compute the _drop* members if we are in a drop zone, else set them to
              // null.
              if (x % ItemSize[ItemState.GRID] < dropZoneWidth ||
                  x % ItemSize[ItemState.GRID] >
                      ItemSize[ItemState.GRID] - dropZoneWidth) {
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
              // In menu edit mode, the computation is much more involved.

              // First we make the coordinates relative to the center.
              x -= this._width / 2;
              y -= this._height / 2;

              // We assume that we are not in a valid drop zone. If we are, this will be
              // set to the appropriate index later.
              this._dropIndex = null;

              // We compute the pointer-center distance. Items cannot be dropped too
              // close to the center.
              const distance = Math.sqrt(x * x + y * y);
              if (distance > ItemSize[ItemState.CENTER] / 2) {

                // Compute the angle between center-pointer and center-up.
                let mouseAngle = Math.acos(x / distance) * 180 / Math.PI;
                if (y < 0) {
                  mouseAngle = 360 - mouseAngle;
                }
                mouseAngle = (mouseAngle + 90) % 360;

                // Compute the angle of all items. As we reset this._dropIndex before,
                // these will not include the gap for the to-be-dropped item. If an item
                // is dragged around (as opposed to external data), the angle of the
                // dragged item will coincide with its successor.
                const itemAngles = this._computeItemAngles();

                // Now compute the _dropIndex by comparing the mouseAngle with the
                // itemAngles. There are a few special cases when there are only a few
                // items in the menu.
                if (itemAngles.length == 0) {
                  // If there is no current item, it's easy: We simply drop at index
                  // zero.
                  this._dropIndex = 0;

                } else if (itemAngles.length == 1) {
                  // If there is one current item, we always drop at zero if it's an
                  // internal drag (as we are obviously dragging the only item around).
                  // If it's an external drag, we have to decide whether to drop before
                  // or after.
                  if (this._dragIndex != null) {
                    this._dropIndex = 0;
                  } else {
                    this._dropIndex = (mouseAngle - itemAngles[0] < 90 ||
                                       mouseAngle - itemAngles[0] > 270) ?
                        0 :
                        1;
                  }

                } else if (itemAngles.length == 2 && this._dragIndex != null) {
                  // If there are two items but one of them is dragged around, we have
                  // to decide whether to drop before or after. However, 'after' means
                  // at index 2, as the item addition happens before the item removal
                  // during an internal drag-and-drop.
                  this._dropIndex = (mouseAngle - itemAngles[0] < 90 ||
                                     mouseAngle - itemAngles[0] > 270) ?
                      0 :
                      2;

                } else {

                  // All other cases can be handled with a loop through the drop zone
                  // wedges between the items. For each wedge, we decide whether the
                  // pointer is inside the wedge.
                  for (let i = 0; i < itemAngles.length; i++) {
                    let wedgeStart = itemAngles[i];
                    let wedgeEnd   = itemAngles[(i + 1) % itemAngles.length];

                    // Wrap around.
                    if (wedgeEnd < wedgeStart) {
                      wedgeEnd += 360;
                    }

                    // Angular width of the wedge.
                    const diff = wedgeEnd - wedgeStart;

                    // The drop zone wedges are considered to directly start at one item
                    // and end at the next one. If however, there is a custom menu at
                    // one side of the wedge, we at some padding to allow dropping into
                    // the custom menu.
                    let wedgeStartPadding = 0;
                    let wedgeEndPadding   = 0;

                    if (this._items[i].getConfig().type == 'CustomMenu') {
                      wedgeStartPadding = 0.25;
                    }

                    if (this._items[(i + 1) % itemAngles.length].getConfig().type ==
                        'CustomMenu') {
                      wedgeEndPadding = 0.25;
                    }

                    // The last wedge has to be handled in a special manner as it allows
                    // dropping at index zero.
                    const lastWedge = i == itemAngles.length - 1 ||
                        (i == itemAngles.length - 2 &&
                         this._dragIndex == itemAngles.length - 1);

                    // The last wedge is basically split in the middle - if dropped in
                    // the clockwise side, we will drop at index zero, if dropped in the
                    // counter-clockwise side, we will drop after the last element.
                    if (lastWedge &&
                        ((mouseAngle >= wedgeStart + diff * 0.5 &&
                          mouseAngle < wedgeEnd - diff * wedgeEndPadding) ||
                         (mouseAngle + 360 >= wedgeStart + diff * 0.5 &&
                          mouseAngle + 360 < wedgeEnd - diff * wedgeEndPadding))) {

                      this._dropIndex = 0;
                      break;

                    } else if (
                        (mouseAngle >= wedgeStart + diff * wedgeStartPadding &&
                         mouseAngle < wedgeEnd - diff * wedgeEndPadding) ||
                        (mouseAngle + 360 >= wedgeStart + diff * wedgeStartPadding &&
                         mouseAngle + 360 < wedgeEnd - diff * wedgeEndPadding)) {

                      // In all other cases we simply drop after the current wedge.
                      this._dropIndex = i + 1;
                      break;
                    }
                  }
                }
              }
            }

            // We need to reposition all items with a smooth animation if any of the
            // below items changed during this callback.
            if (this._dropColumn != lastDropColumn || this._dropRow != lastDropRow ||
                this._dropIndex != lastDropIndex) {
              this._restartAnimation = true;
            }

            this.queue_allocate();
          };

          // When the pointer leaves the widget, we reset the _drop* members and update
          // the item layout.
          const dragLeave = () => {
            // For external drag-and-drop events, 'leave' is called before 'drop'. We
            // have to reset this._dropIndex in 'leave', to make sure that the items
            // move back to their original position when the pointer leaves the drop
            // area. However, we need this._dropIndex in 'drop' to fire the 'add-item'
            // and 'add-data' signals. Therefore, we temporarily store this._dropIndex
            // in this._lastDropIndex. This is only used a few lines below in the 'drop'
            // signal handler.
            this._lastDropIndex = this._dropIndex;

            this._dropColumn = null;
            this._dropRow    = null;
            this._dropIndex  = null;
            this.updateLayout();
          };

          // When an internal item or external data is dropped, either the 'drop-item'
          // or 'drop-data' signals are emitted. There are several cases where this may
          // fail; usually the 'notification' signal will be emitted to notify the user
          // about the reason.
          const dragDrop = (value, internalDrag, containsUris) => {
            // See documentation of the 'leave' signal above.
            if (this._dropIndex == null) {
              this._dropIndex = this._lastDropIndex;
            }

            // This shouldn't happen.
            if (this._dropIndex == null) {
              return false;
            }

            // For internal drop events, the dropped data is a JSON representation of
            // the dropped item.
            if (internalDrag) {

              const config = JSON.parse(value);

              // Do not allow top-level drops of actions.
              if (this._inMenuOverviewMode() &&
                  ItemRegistry.getItemTypes()[config.type].class != ItemClass.MENU) {

                this.emit(
                    // Translators: This is shown as an in-app notification when the
                    // user attempts to drag an action in the menu editor to the menu
                    // overview.
                    'notification', _('Actions cannot be turned into toplevel menus.'));

                this._dropColumn = null;
                this._dropRow    = null;
                this._dropIndex  = null;
                return false;
              }

              this.emit('drop-item', value, this._dropIndex);

            } else {

              // Do not allow external drops in menu overview mode.
              if (this._inMenuOverviewMode()) {

                this.emit(
                    'notification',
                    // Translators: This is shown as an in-app notification when the
                    // user attempts to drag external stuff to the menu editor's
                    // overview.
                    _('You can only create new Action items inside of Custom Menus.'));

                this._dropColumn = null;
                this._dropRow    = null;
                this._dropIndex  = null;
                return false;
              }

              // If the dropped data contains a list of URIs, call the 'drop-data' once
              // for each item.
              if (containsUris) {
                value.split(/\r?\n/).forEach((line, i) => {
                  if (line != '') {
                    this.emit('drop-data', line, this._dropIndex + i);
                  }
                });
              } else {
                this.emit('drop-data', value, this._dropIndex);
              }
            }

            // Reset all _drop* members. We do not need to trigger a re-layout as this
            // will be done in the resulting add() call.
            this._dropColumn = null;
            this._dropRow    = null;
            this._dropIndex  = null;

            return true;
          };

          if (utils.gtk4()) {
            this._dropTarget =
                new Gtk.DropTarget({actions: Gdk.DragAction.MOVE | Gdk.DragAction.COPY});

            // We accept strings: Menu items are represented with a JSON representation
            // (the same format which is used for saving Fly-Pie's settings). External
            // drops usually are URIs.
            this._dropTarget.set_gtypes([GObject.TYPE_STRING]);

            // We accept everything :)
            this._dropTarget.connect('accept', () => true);

            this._dropTarget.connect('motion', (t, x, y) => {
              dragMotion(x, y);

              // Return null if the drop at the current position is not possible.
              return this._dropIndex == null ? null : Gdk.DragAction.MOVE;
            });


            this._dropTarget.connect('leave', dragLeave);

            this._dropTarget.connect('drop', (t, what) => {
              const internalDrag = t.get_drop().get_drag() != null;
              const containsUris =
                  t.get_drop().formats.contain_mime_type('text/uri-list');
              return dragDrop(what, internalDrag, containsUris);
            });

            this.add_controller(this._dropTarget);
          } else {

            this.drag_dest_set(
                0, this._dndTargets, Gdk.DragAction.MOVE | Gdk.DragAction.COPY);
            this.drag_dest_set_track_motion(true);
            this.connect('drag-leave', () => {
              dragLeave();
              this.drag_unhighlight();
            });
            this.connect('drag-data-received', (w, context, x, y, data, i, time) => {
              // These numbers refer to the number in this._dndTargets.
              const internalDrag = i == 0;
              const containsUris = i == 1;
              const success      = dragDrop(
                  ByteArray.toString(data.get_data()), internalDrag, containsUris);
              Gtk.drag_finish(
                  context, success, context.get_selected_action() == Gdk.DragAction.MOVE,
                  time);
            });

            this.connect('drag-drop', (w, context, x, y, time) => {
              const availableTargets = context.list_targets();

              for (let i = 0; i < this._dndTargets.length; i++) {
                if (availableTargets.includes(this._dndTargets[i].target)) {
                  this.drag_get_data(context, this._dndTargets[i].target, time);
                  return;
                }
              }

              this.drag_get_data(context, 'text/plain', time);
            });

            this.connect('drag-motion', (w, context, x, y, time) => {
              dragMotion(x, y);

              // Return false if the drop at the current position is not possible.
              if (this._dropIndex == null) {
                return false;
              }

              this.drag_highlight();

              // Make sure to choose the copy action if Ctrl is held down.
              const pointer = Gdk.Display.get_default().get_default_seat().get_pointer();
              const mods    = w.get_window().get_device_position(pointer)[3];

              if (mods & Gdk.ModifierType.CONTROL_MASK) {
                Gdk.drag_status(context, Gdk.DragAction.COPY, time);
              } else {
                Gdk.drag_status(context, Gdk.DragAction.MOVE, time);
              }

              return true;
            });
          }
        }
      }

      // ------------------------------------------------------ overridden virtual methods

      // This widget uses standard WIDTH_FOR_HEIGHT sizing.
      vfunc_get_request_mode() {
        return Gtk.SizeRequestMode.WIDTH_FOR_HEIGHT;
      }

      // This widget requests a width so that in overview mode at least four items can be
      // displayed per row. The height is requested so that all items can be shown at the
      // given width. However, this is implemented differently on GTK3 and GTK4.
      // Therefore, there are two different versions of the FlyPieMenuEditor defined at
      // the bottom of this file overriding the respective vfuncs.

      // This method is responsible for computing the positions of all displayed items.
      // There are two completely different display modes: The menu overview mode and menu
      // edit mode. It considers the current _dropIndex so that an artificial gap is
      // created where a item is about to be dropped.
      vfunc_size_allocate(width, height, baseline) {

        // On GTK3, the parameters are different. The first parameter is actually an
        // allocation rectangle.
        if (!utils.gtk4()) {
          const allocation = width;

          // We also have to chain-up to the base class.
          super.vfunc_size_allocate(allocation);

          height = allocation.height;
          width  = allocation.width;
        }

        // This helper lambda assigns animated values to the given item which can be used
        // to smoothly animate the item position in the given time to the specified
        // location.
        const setAnimation = (item, time, x, y) => {
          if (item.x == undefined) {
            item.x       = new AnimatedValue({direction: AnimationDirection.OUT});
            item.y       = new AnimatedValue({direction: AnimationDirection.OUT});
            item.x.start = x;
            item.y.start = y;
          } else if (this._restartAnimation) {
            // Use the current values as new starting point.
            item.x.start = item.x.get(time);
            item.y.start = item.y.get(time);
          }

          item.x.end = x;
          item.y.end = y;

          // Add timing information only if _restartAnimation is currently set. Else the
          // animated values will return their end value immediately.
          if (this._restartAnimation) {
            item.x.startTime = time;
            item.x.endTime   = time + TRANSITION_DURATION;
            item.y.startTime = time;
            item.y.endTime   = time + TRANSITION_DURATION;
          }
        };

        // Store the current widget bounds.
        this._width  = width;
        this._height = height;

        // Some values we will use more often below.
        const time    = this.get_frame_clock().get_frame_time() / 1000;
        const centerX = Math.floor(width / 2);
        const centerY = Math.floor(height / 2);
        const radius  = ItemSize[ItemState.GRID] * 1.4;  // Radius of the edited menu.

        // -------------------------------------------------------------------------------

        // We show the if-empty hint if no items were given.
        this._ifEmptyHint.visible = this._items.length == 0 && this._centerItem == null;

        // The add-new-item hint is shown whenever there are zero items in the current
        // list.
        this._addItemHint.visible = this._items.length == 0;

        // -------------------------------------------------------------------------------

        // In this part of the method we will compute the position of each item.

        // In menu-overview mode, we have to compute the grid position of each item. If
        // there is a drag operation going on, the items will move sideways to make space
        // for the dropped item.
        if (this._inMenuOverviewMode()) {

          this._columnCount = Math.floor(width / ItemSize[ItemState.GRID]);
          this._rowCount    = Math.ceil(this._items.length / this._columnCount);

          if (this._rowCount == 1) {
            this._columnCount = this._items.length;
          }

          // Make sure that the gris is always centered.
          this._gridOffsetX = (width - this._columnCount * ItemSize[ItemState.GRID]) / 2;
          this._gridOffsetY = (height - this._rowCount * ItemSize[ItemState.GRID]) / 2;

          for (let i = 0; i < this._items.length; i++) {

            const column = i % this._columnCount;
            const row    = Math.floor(i / this._columnCount);

            // Compute the horizontal offset to make space for the dropped item.
            let offset = 0;

            if (row == this._dropRow) {
              const range    = 3;   // Up to three items will move.
              const strength = 15;  // How much they move.

              if (column < this._dropColumn) {
                offset = -Math.max(0, range - (this._dropColumn - column) + 1) * strength;
              } else {
                offset = Math.max(0, range - (column - this._dropColumn)) * strength;
              }
            }

            // Compute the pixel coordinate and setup an animation to this new position.
            const x = this._gridOffsetX + column * ItemSize[ItemState.GRID] + offset;
            const y = this._gridOffsetY + row * ItemSize[ItemState.GRID];
            setAnimation(this._items[i], time, x, y);
          }

        } else {

          // In menu-edit mode, we can simply use the _computeItemAngles() method and
          // convert the angles to Cartesian coordinates.
          const angles = this._computeItemAngles();

          this._items.forEach((item, i) => {
            const angle = angles[i] * Math.PI / 180;
            let x       = Math.floor(Math.sin(angle) * radius) + centerX;
            let y       = -Math.floor(Math.cos(angle) * radius) + centerY;

            // Center the item at this coordinate.
            x -= ItemSize[item.state] / 2;
            y -= ItemSize[item.state] / 2;
            setAnimation(item, time, x, y);
          });

          // Move the center item to... well... the center.
          const x = centerX - ItemSize[this._centerItem.state] / 2;
          const y = centerY - ItemSize[this._centerItem.state] / 2;
          setAnimation(this._centerItem, time, x, y);
        }

        // If a parent angle is given, move the back-button to the corresponding position.
        if (this._parentAngle != undefined) {
          const angle = this._parentAngle * Math.PI / 180;

          let x = Math.floor(Math.sin(angle) * radius) + centerX;
          let y = -Math.floor(Math.cos(angle) * radius) + centerY;
          x -= ItemSize[this._backButton.state] / 2;
          y -= ItemSize[this._backButton.state] / 2;
          setAnimation(this._backButton, time, x, y);

        } else {

          // If not, move it the center.
          const x = centerX - ItemSize[this._backButton.state] / 2;
          const y = centerY - ItemSize[this._backButton.state] / 2;
          setAnimation(this._backButton, time, x, y);
        }

        // -------------------------------------------------------------------------------

        // Now that all items have a position assigned to them, we will have a look at the
        // transitions. If a transition to a new set of items is requested, we have to
        // modify our animations accordingly.

        // Different things have to be done for the different transitions. You can read
        // more in the documentation of TransitionType at the top of this file.
        switch (this._upcomingTransition) {
          // Transitions between deeper menu levels are basically the same, only the
          // direction in which items are moved differs. As this angle is set in
          // setItems(), we do not have to differentiate here.
          case TransitionType.TRANSITION_B:
          case TransitionType.TRANSITION_C:
            const angle   = this._transitionAngle * Math.PI / 180;
            const offsetX = Math.floor(Math.sin(angle) * radius);
            const offsetY = -Math.floor(Math.cos(angle) * radius);

            this._items.forEach(item => {
              item.x.start -= offsetX;
              item.y.start -= offsetY;
            });

            this._centerItem.x.start -= offsetX;
            this._centerItem.y.start -= offsetY;

            break;

          // All other transitions do not require moving the items.
          default:
            break;
        }

        // Reset this.
        this._upcomingTransition = TransitionType.NONE;

        // -------------------------------------------------------------------------------

        // Now, in the last part, we will call _allocateChildren() to actually move the
        // items according to their animated values. If _restartAnimation is set, a
        // timeout will be used to call _allocateChildren repeatedly.

        if (this._restartAnimation) {

          this._restartAnimation = false;

          // Cancel any running timeouts.
          if (this._updateTimeout != undefined && this._updateTimeout >= 0) {
            this.remove_tick_callback(this._updateTimeout);
            this._updateTimeout = -1;
          }

          // Create a new timeout which will cancel itself once all animations are done.
          this._updateTimeout = this.add_tick_callback(() => {
            const time        = this.get_frame_clock().get_frame_time() / 1000;
            const allFinished = this._allocateChildren(time);

            if (allFinished) {
              this._updateTimeout = -1;
              return false;
            }

            return true;
          });
        }
        this._allocateChildren(time);
      }

      // ---------------------------------------------------------------- public interface

      // This method completely replaces the current set of displayed menu items. The only
      // mandatory parameter is 'configs', which has to be an array of menu configurations
      // (of which this class only requires the 'name', 'icon', 'shortcut', and 'type'
      // properties).
      // If 'selectedIndex' is given, the item at the specified position will be
      // preselected (-1 for the center item).
      // If 'centerConfig' is given, the items will be drawn in a circular fashion with an
      // item based on this config in the center (e.g. we are not in menu overview mode).
      // If 'parentAngle' is given, a back-navigation item will be drawn at this position
      // (e.g. we are in submenu mode).
      setItems(configs, selectedIndex, centerConfig, parentAngle) {

        // In the first part of this method we will decide what kind of transition
        // animation will be required to show the new items.
        // Based on the parameters, we can decide whether we should display the
        // menu-overview, a top-level menu, or a submenu. And based on the old display
        // mode, this method will request an animated transition to make things a bit more
        // intuitive for the user. This happens according to the scheme described in the
        // documentation of TransitionType at the beginning of this file.

        let wentOneLevelDeeper = false;
        let wentOneLevelUp     = false;

        // If the new center config is amongst the old items, we most likely went down
        // one level.
        if (centerConfig) {
          for (let i = 0; i < this._items.length; i++) {
            const item = this._items[i].getConfig();
            if (item.name == centerConfig.name && item.icon == centerConfig.icon) {
              wentOneLevelDeeper = true;
              break;
            }
          }
        }

        // If the old center item is amongst the new items, we most likely went up one
        // level.
        if (this._centerItem) {
          for (let i = 0; i < configs.length; i++) {
            const item = configs[i];
            if (item.name == this._centerItem.getConfig().name &&
                item.icon == this._centerItem.getConfig().icon) {
              wentOneLevelUp = true;
              break;
            }
          }
        }

        if (this._centerItem != null && wentOneLevelDeeper) {
          // Transition one level deeper.
          this._upcomingTransition = TransitionType.TRANSITION_B;
          this._transitionAngle    = parentAngle;
        } else if (centerConfig != null && wentOneLevelUp) {
          // Transition one level up.
          this._upcomingTransition = TransitionType.TRANSITION_C;
          this._transitionAngle    = (this._parentAngle + 180) % 360;
        } else {
          // Any other transition, usually multiple levels up at once.
          this._upcomingTransition = TransitionType.TRANSITION_A;
        }

        // -------------------------------------------------------------------------------

        // In this part we will hide all existing items.
        const oldItems = [...this._items];

        if (this._centerItem) {
          oldItems.push(this._centerItem);
        }

        // This is done differently on GTK3 / GTK4.
        oldItems.forEach(item => {
          if (utils.gtk4()) {
            item.unparent();
          } else {
            this.remove(item);
          }
        });

        // Reset all currently displayed items.
        this._items        = [];
        this._centerItem   = null;
        this._selectedItem = null;

        // -------------------------------------------------------------------------------

        // In this last part we create all new items.

        // Create an item for each config object.
        for (let i = 0; i < configs.length; i++) {
          const item = this._createItem(
              configs[i], centerConfig ? ItemState.CHILD : ItemState.GRID);
          this._items.push(item);

          // Make it selected if necessary.
          if (i == selectedIndex) {
            this._selectedItem = item;
            item.button.active = true;
          }
        }

        // Create the center item.
        if (centerConfig) {
          this._centerItem = this._createItem(centerConfig, ItemState.CENTER);

          // Make it selected if necessary.
          if (selectedIndex == -1) {
            this._selectedItem             = this._centerItem;
            this._centerItem.button.active = true;
          }
        }

        // -------------------------------------------------------------------------------

        // Last but not least, update the back-navigation button.

        this._parentAngle        = parentAngle;
        this._backButton.visible = parentAngle != undefined;

        if (parentAngle != undefined) {
          this._backButton.get_child().queue_draw();
        }

        // Finally, queue up a complete re-layout.
        this.updateLayout();
      }

      // Adds a new item to the list of currently displayed items at the given index. The
      // new item will be automatically selected.
      addItem(config, where) {

        // Create the new item.
        const item = this._createItem(
            config, this._inMenuOverviewMode() ? ItemState.GRID : ItemState.CHILD);

        // Make it selected.
        this._selectedItem = item;
        item.button.active = true;

        // Append it at the proper position.
        this._items.splice(where, 0, item);

        // Only queue up a complete re-layout if there is not a drag operation going on.
        // In this case, there will be a emission of the drop target's 'leave' signal
        // which will call updateLayout() anyways. If we call it too early, there will be
        // some jittering as the dragged item will be remove _after_ it has been re-added
        // via this method.
        if (this._dragIndex == null) {
          this.updateLayout();
        }
      }

      // Deletes the item at the given index.
      removeItem(which) {
        const [removed] = this._items.splice(which, 1);

        if (removed == this._selectedItem) {
          this._selectedItem = null;
        }

        if (utils.gtk4()) {
          removed.unparent();
        } else {
          this.remove(removed);
        }
      }

      // Updates the currently selected item with the data from the given configuration.
      // Depending on the current state, this may consider the the properties 'name',
      // 'icon', and 'shortcut'.
      updateSelected(config) {
        if (this._selectedItem) {
          this._selectedItem.setConfig(config);
        }
      }

      // Triggers the recomputation all item positions. From outside, it is usually not
      // required to call this. Currently, this is only required when the fixed angle of
      // an item is modified.
      updateLayout() {
        this._restartAnimation = true;
        this.queue_allocate();
      }

      // ------------------------------------------------------------------- private stuff

      // Creates a new FlyPieMenuEditorItem based on the given configuration and state. It
      // will be already revealed and parented to this.
      _createItem(config, itemState) {

        // Create the item.
        const item = new FlyPieMenuEditorItem(itemState);
        item.setConfig(config);

        // The MenuEditor is derived from Gtk.Fixed on GTK3 and from Gtk.Widget on GTK4.
        // So we have add child items differently.
        if (utils.gtk4()) {
          item.set_parent(this);
        } else {
          this.put(item, 0, 0);
        }
        item.set_reveal_child(true);

        // Assign the new item's toggle button to our radio button group so that only one
        // item can be selected at any time.
        if (this._radioGroup) {
          if (utils.gtk4()) {
            item.button.set_group(this._radioGroup);
          } else {
            item.button.join_group(this._radioGroup);
          }
        } else {
          this._radioGroup = item.button;
        }

        // If it's a custom menu, make the edit-button clickable.
        if (config.type == 'CustomMenu') {
          item.editButton.connect('clicked', () => {
            this._selectedItem = item;
            this.emit('edit-item', this._items.indexOf(item));
          });
        }

        // Now we set up the drag source. Most items are draggable, except for center
        // items. The drag source provides a stringified JSON version of the item config.
        // Setting up drag and drop is quite different on GTK3 / GTK4. Therefore this code
        // looks a bit more difficult than it actually is. There are a few lambdas
        // involved which are then connected to the various signals of the widget (GTK3)
        // or the EventController (GTK4).
        if (itemState != ItemState.CENTER) {

          // At drag begin, we make the icon translucent in overview mode and invisible
          // in menu edit mode.
          const dragBegin = () => {
            item.opacity    = this._inMenuOverviewMode() ? 0.2 : 0.0;
            item.sensitive  = false;
            this._dragIndex = this._items.indexOf(item);
            this.updateLayout();
          };

          // If the drag was a move action, the item will be deleted.
          const dragDeleteData = () => {
            let removeIndex = this._items.indexOf(item);
            this.removeItem(removeIndex);
            this.emit('remove-item', removeIndex);
          };

          // If the drag operation is ended, we make the item visible again and
          // update the layout.
          const dragEnd = () => {
            item.opacity    = 1;
            item.sensitive  = true;
            this._dragIndex = null;
            this.updateLayout();
          };

          // Now connect all the handlers from above.
          if (utils.gtk4()) {

            // Do to https://gitlab.gnome.org/GNOME/gtk/-/issues/4259, copy does
            // not work on X11. If we added the copy action on X11, it would be chosen as
            // default action and the user would have to hold down shift in order to move
            // items...
            let actions = Gdk.DragAction.MOVE;
            if (utils.getSessionType() == 'wayland') {
              actions |= Gdk.DragAction.COPY;
            }

            let dragSource = new Gtk.DragSource({actions: actions});

            // Connect all handlers.
            dragSource.connect('drag-begin', dragBegin);
            dragSource.connect('drag-cancel', dragEnd);
            dragSource.connect('drag-end', (s, drag, deleteData) => {
              if (deleteData) {
                dragDeleteData();
              }

              dragEnd();
            });

            // The item's icon is used as drag graphic.
            dragSource.connect('prepare', (s, x, y) => {
              s.set_icon(Gtk.WidgetPaintable.new(item.icon), x, y);
              return Gdk.ContentProvider.new_for_value(JSON.stringify(item.getConfig()));
            });

            // For some reason, the drag source does not work anymore once the
            // ToggleButton was toggled. Resetting the EventController seems to be a
            // working workaround.
            item.button.connect('clicked', (b) => {
              dragSource.reset();
            });

            item.button.add_controller(dragSource);

          } else {

            // Items provide data in the custom 'FLY-PIE-ITEM' format (which is actually
            // json data).
            item.button.drag_source_set(
                Gdk.ModifierType.BUTTON1_MASK,
                [Gtk.TargetEntry.new('FLY-PIE-ITEM', 0, 0)],
                Gdk.DragAction.MOVE | Gdk.DragAction.COPY);

            // Connect all handlers.
            item.button.connect('drag-data-delete', dragDeleteData);
            item.button.connect('drag-failed', dragEnd);
            item.button.connect('drag-end', dragEnd);
            item.button.connect('drag-data-get', (w, c, data) => {
              data.set(
                  'FLY-PIE-ITEM', 8,
                  ByteArray.fromString(JSON.stringify(item.getConfig())));
            });

            // The item's icon is used as drag graphic.
            item.button.connect('drag-begin', () => {
              const font  = this._settings.get_string('font');
              const color = utils.getColor(item.button);
              const size  = Math.min(
                  item.icon.get_allocated_width(), item.icon.get_allocated_height());
              const surface = utils.createIcon(item.getConfig().icon, size, font, color);
              const pixbuf  = Gdk.pixbuf_get_from_surface(surface, 0, 0, size, size);
              item.button.drag_source_set_icon_pixbuf(pixbuf);
              dragBegin();
            });
          }
        }

        // Non-center items of type 'CustomMenu' can also receive drops. The items type
        // could theoretically change at runtime when the setConfig() method is called.
        // Therefore, we check the type in the drop handler and not right here in the
        // beginning.
        if (itemState != ItemState.CENTER) {

          // When something is dropped, we either emit 'drop-data-into' (for external
          // drop events) or 'drop-data-into' (for internal drop events).
          const dragDrop = (value, internalDrag, containsUris) => {
            const dropIndex = this._items.indexOf(item);

            if (internalDrag) {
              this.emit('drop-item-into', value, dropIndex);

            } else {

              // If the external drop event provides a list of URIs, we call the signal
              // once for each entry.
              if (containsUris) {
                value.split(/\r?\n/).forEach(line => {
                  if (line != '') {
                    this.emit('drop-data-into', line, dropIndex);
                  }
                });
              } else {
                this.emit('drop-data-into', value, dropIndex);
              }
            }

            // Make the item the active one.
            this._selectedItem               = item;
            this._selectedItem.button.active = true;

            // Reset all drop members.
            this._dropColumn = null;
            this._dropRow    = null;
            this._dropIndex  = null;

            return true;
          };

          // Now connect the handler. This differs on GTK3 / GTK4.
          if (utils.gtk4()) {

            const dropTarget =
                new Gtk.DropTarget({actions: Gdk.DragAction.MOVE | Gdk.DragAction.COPY});
            dropTarget.set_gtypes([GObject.TYPE_STRING]);

            // We accept everything as long as the item is a custom menu.
            dropTarget.connect('accept', () => item.getConfig().type == 'CustomMenu');

            dropTarget.connect('drop', (t, what) => {
              const internalDrag = t.get_drop().get_drag() != null;
              const containsUris =
                  t.get_drop().formats.contain_mime_type('text/uri-list');
              return dragDrop(what, internalDrag, containsUris);
            });

            // Highlight the button if the pointer moves over it.
            dropTarget.connect('motion', () => Gdk.DragAction.MOVE);

            item.button.add_controller(dropTarget);

          } else {

            item.button.drag_dest_set(
                Gtk.DestDefaults.DROP, this._dndTargets,
                Gdk.DragAction.MOVE | Gdk.DragAction.COPY);
            item.button.drag_dest_set_track_motion(true);

            item.button.connect(
                'drag-data-received', (w, context, x, y, data, i, time) => {
                  // These numbers refer to the number in this._dndTargets.
                  const internalDrag = i == 0;
                  const containsUris = i == 1;
                  dragDrop(
                      ByteArray.toString(data.get_data()), internalDrag, containsUris);
                });

            // We accept everything as long as the item is a custom menu.
            item.button.connect('drag-motion', (w, context, x, y, time) => {
              if (item.getConfig().type != 'CustomMenu') {
                return false;
              }

              // Draw a highlight around the button.
              item.button.drag_highlight();

              // Make sure to choose the copy action if Ctrl is held down.
              const pointer = Gdk.Display.get_default().get_default_seat().get_pointer();
              const mods    = w.get_window().get_device_position(pointer)[3];

              if (mods & Gdk.ModifierType.CONTROL_MASK) {
                Gdk.drag_status(context, Gdk.DragAction.COPY, time);
              } else {
                Gdk.drag_status(context, Gdk.DragAction.MOVE, time);
              }

              return true;
            });

            item.button.connect('drag-leave', () => {
              item.button.drag_unhighlight();
            });
          }
        }

        // Emit the 'select' signal when the button is pressed.
        item.button.connect('clicked', (b) => {
          if (b.active) {
            this._selectedItem = item;
            this.emit('select-item', this._items.indexOf(item));
          }
        });

        // Show all children on GTK3.
        if (!utils.gtk4()) {
          item.show_all();
        }

        return item;
      }

      // A small helper method which returns true if the editor is currently in overview
      // mode.
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
      // successor and all other angles will be computed as if the item did not exist.
      _computeItemAngles() {

        // This array will be passed utils.computeItemAngles() further below. For each
        // item in the menu, it should contain an empty object. If the corresponding item
        // as a fixed angle, the corresponding object in the array should contain the
        // angle as value for a property called "angle".
        const fixedAngles = [];

        // Loop through all menu items.
        this._items.forEach((item, i) => {
          // If the drop-gap is at this position, add an artificial item. This will change
          // the angles of all other items as if there was an item at this position.
          if (this._dropIndex == i) {
            fixedAngles.push({});
          }

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
        });

        // There's a special case where the drop index is after the last element - in this
        // case we have to add an artificial item to the end of the list so that the
        // angles of all other items are shifted to leave a gap for the to-be-dropped
        // item.
        if (this._dropIndex == this._items.length) {
          fixedAngles.push({});
        }

        const angles = utils.computeItemAngles(fixedAngles, this._parentAngle);

        // If we added an artificial item to leave an angular gap for the to-be-dropped
        // item, we have to remove this again as there os no real item at this position.
        // We only wanted to affect the angles for the adjacent items.
        if (this._dropIndex != null) {
          let removeIndex = this._dropIndex;

          if (this._dragIndex != null && this._dropIndex > this._dragIndex + 1) {
            removeIndex -= 1;
          }

          angles.splice(removeIndex, 1);
        }

        if (this._dragIndex != null) {
          angles.splice(this._dragIndex, 0, angles[this._dragIndex % angles.length]);
        }

        return angles;
      }

      // Calls size_allocate() on all child items of this. For the position of each item
      // the AnimatedValues are queried, the size of each item depends on its ItemState.
      // Returns true if all animations are done.
      _allocateChildren(time) {
        let allFinished = true;

        // This will be called once for each item.
        const impl = (item) => {
          const allocation = new Gdk.Rectangle(
              {x: 0, y: 0, width: ItemSize[item.state], height: ItemSize[item.state]});

          if (item.x && item.y) {
            allocation.x = item.x.get(time);
            allocation.y = item.y.get(time);
            allFinished &= item.x.isFinished(time);
            allFinished &= item.y.isFinished(time);
          }

          utils.sizeAllocate(item, allocation);
        };

        // Update the position of all current items, the center item and the back button.
        this._items.forEach(impl);

        impl(this._backButton);

        if (this._centerItem) {
          impl(this._centerItem);
        }

        // Update the allocations of the various hint labels.
        const allocation =
            new Gdk.Rectangle({x: 0, y: 0, width: this._width, height: this._height});
        utils.sizeAllocate(this._ifEmptyHint, allocation);
        utils.sizeAllocate(this._addItemHint, allocation);

        return allFinished;
      }
    });
  }

  ////////////////////////////////////////////////////////////////////////////////////////
  // As mentioned in the description of the FlyPieMenuEditorBase class, we need to      //
  // override different vfuncs on GTK3 / GTK4. Therefore we derive different            //
  // FlyPieMenuEditors for GTK3 and GTK4.                                               //
  ////////////////////////////////////////////////////////////////////////////////////////

  if (GObject.type_from_name('FlyPieMenuEditor') == null) {

    const MIN_GRID_SIZE = ItemSize[ItemState.GRID] * 4;

    if (utils.gtk4()) {

      ////////////////////////////////////////////////////////////////////////////////////
      // The GTK4 FlyPieMenuEditor.                                                     //
      ////////////////////////////////////////////////////////////////////////////////////

      GObject.registerClass({GTypeName: 'FlyPieMenuEditor'},
                            class FlyPieMenuEditor extends FlyPieMenuEditorBase {
        // ---------------------------------------------------- overridden virtual methods

        // This computes the required hight for a given width when in menu overview mode.
        // In all other cases it simply returns the size required to fit 4x4 grid items.
        vfunc_measure(orientation, for_size) {
          if (this._inMenuOverviewMode()) {
            if (orientation == Gtk.Orientation.HORIZONTAL) {
              return [MIN_GRID_SIZE, MIN_GRID_SIZE, -1, -1];
            }

            // The possible amount of columns.
            const columns = Math.floor(for_size / ItemSize[ItemState.GRID]);

            // The required amount of rows.
            const rows = Math.ceil(this._items.length / columns);

            // The required height of the grid.
            const gridHeight = rows * ItemSize[ItemState.GRID];
            return [gridHeight, gridHeight, -1, -1];
          }

          // In menu-edit mode we simply return a square shaped region of the same size as
          // the grid width.
          return [MIN_GRID_SIZE, MIN_GRID_SIZE, -1, -1];
        }
      });

    } else {

      ////////////////////////////////////////////////////////////////////////////////////
      // The GTK3 FlyPieMenuEditor.                                                     //
      ////////////////////////////////////////////////////////////////////////////////////

      GObject.registerClass({GTypeName: 'FlyPieMenuEditor'},
                            class FlyPieMenuEditor extends FlyPieMenuEditorBase {
        // ---------------------------------------------------- overridden virtual methods

        // This computes the required hight for a given width when in menu overview mode.
        vfunc_get_preferred_height_for_width(width) {
          if (this._inMenuOverviewMode()) {
            // The possible amount of columns.
            const columns = Math.floor(width / ItemSize[ItemState.GRID]);

            // The required amount of rows.
            const rows = Math.ceil(this._items.length / columns);

            // The required height of the grid.
            const gridHeight = rows * ItemSize[ItemState.GRID];
            return [gridHeight, gridHeight];
          }

          // In menu-edit mode we simply return a square shaped region of the same size as
          // the grid width.
          return [MIN_GRID_SIZE, MIN_GRID_SIZE];
        }

        // In all other cases we simply return the size required to fit 4x4 grid items.
        vfunc_get_preferred_height() {
          return [MIN_GRID_SIZE, MIN_GRID_SIZE];
        }

        // In all other cases we simply return the size required to fit 4x4 grid items.
        vfunc_get_preferred_width() {
          return [MIN_GRID_SIZE, MIN_GRID_SIZE];
        }

        // In all other cases we simply return the size required to fit 4x4 grid items.
        vfunc_get_preferred_width_for_height(height) {
          return [MIN_GRID_SIZE, MIN_GRID_SIZE];
        }
      });
    }
  }
}
