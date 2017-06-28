/////////////////////////////////////////////////////////////////////////////////////////
//                                                                                     //
//    _____                    ___  _     ___       This software may be modified      //
//   / ___/__  ___  __ _  ___ / _ \(_)__ |_  |      and distributed under the          //
//  / (_ / _ \/ _ \/  ' \/ -_) ___/ / -_) __/       terms of the MIT license. See      //
//  \___/_//_/\___/_/_/_/\__/_/  /_/\__/____/       the LICENSE file for details.      //
//                                                                                     //
//  Authors: Simon Schneegans (code@simonschneegans.de)                                //
//                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////

const Clutter        = imports.gi.Clutter;
const ExtensionUtils = imports.misc.extensionUtils;
const Lang           = imports.lang;
const Main           = imports.ui.main;
const Tweener        = imports.ui.tweener;
const St             = imports.gi.St;
const Gio            = imports.gi.Gio;

const Me = ExtensionUtils.getCurrentExtension();

const Background     = Me.imports.background.Background;
const debug          = Me.imports.debug.debug;

const MONITOR_MARGIN = 10;
const ITEM_SPACING   = 0;
const ICON_SIZE      = 80;
const ITEM_SIZE      = 110;
const DEPTH_SPACING  = 320;

const ACTIVE_ICON_OPACITY  = 255;
const ACTIVE_LABEL_OPACITY = 255;

const INACTIVE_ICON_OPACITY  = 255;
const INACTIVE_LABEL_OPACITY = 0;

const SUB_ICON_OPACITY  = 50;
const SUB_LABEL_OPACITY = 0;

const TileMenu = new Lang.Class({
  Name : 'TileMenu',

  // ----------------------------------------------------------- constructor / destructor

  _init : function(onSelect, onCancel) {

    this._onSelect = onSelect;
    this._onCancel = onCancel;

    this._background = new Background();

    this._window = new St.Widget({
      style_class : 'modal-dialog popup-menu tile-menu-modal'
    });

    this._window.set_pivot_point(0.5, 0.5);
    this._background.actor.add_child(this._window);

    let itemContainer = new St.Widget({
      style_class : 'tile-menu-child-container'
    });

    this._window.childItemContainer = itemContainer;
    this._window.add_child(itemContainer);

    this._background.actor.connect('button-release-event', 
                                   Lang.bind(this, this._onButtonRelease));
    this._background.actor.connect('key-release-event', 
                                   Lang.bind(this, this._onKeyRelease));
    this._window.connect('button-release-event', 
                                   Lang.bind(this, this._onButtonRelease));
    this._openSubMenus = [];
  },

  destroy : function() {
    this._background.destroy();
  },

  // ------------------------------------------------------------------- public interface

  show : function(menu) {
    this._openSubMenus = [];
    this._window.childItemContainer.remove_all_children();
    
    this._createMenuItems(this._window.childItemContainer, menu, '');
    this._updateMenuItemPositions(this._window.childItemContainer);

    this._updateMenuOpacity();
    this._updateMenuReactiveness();
    // this._updateMenuDepth();

    // display the background actor
    if (!this._background.show()) {
      // something went wrong, most likely we failed to get the pointer grab
      return false;
    }

    // calculate window position 
    let [pointerX, pointerY, mods] = global.get_pointer();
    let [posX, posY] = this._clampToToMonitor(pointerX-this._window.width/2, 
                                              pointerY-this._window.height/2, 
                                              this._window.width, this._window.height, 
                                              MONITOR_MARGIN);
    this._window.set_position(posX, posY);

    // add an animation for the window scale
    this._window.set_scale(0.5, 0.5);
    Tweener.addTween(this._window, {
      time: 0.2,
      transition: 'easeOutBack',
      scale_x: 1, scale_y: 1
    });

    return true;
  },

  // (x, y) is the top left corner of the box to be clamped, 
  // return value is a new position (x, y)
  _clampToToMonitor : function(x, y, width, height, margin) {
    let monitor = Main.layoutManager.currentMonitor;

    let minX = margin;
    let minY = margin;

    let maxX = monitor.width - margin - width;
    let maxY = monitor.height - margin - height;

    let posX = Math.min(Math.max(x, minX), maxX);
    let posY = Math.min(Math.max(y, minY), maxY);

    return [Math.floor(posX), Math.floor(posY)];
  },

  _hideLevel : function() {
    if (this._openSubMenus.length > 0) {
      let item = this._openSubMenus.pop();
      let scale = this._getSubMenuCollapsedScale(item.childItemContainer);
      Tweener.addTween(item.childItemContainer, {
        time: 0.3,
        transition: 'easeOutBack',
        scale_x: scale, scale_y: scale,
        translation_x: 0, translation_y: 0
      });

      this._updateMenuOpacity();
      this._updateMenuReactiveness();
      // this._updateMenuDepth();

      return false;
    } else {
      this._hideAll();

      return true;
    }
  },

  _hideAll : function() {
    Tweener.addTween(this._window, {
      time: 0.2,
      transition: 'easeInBack',
      scale_x: 0.5, scale_y: 0.5
    });

    this._background.hide();
  },

  // ---------------------------------------------------------------------- private stuff

  _createMenuItems : function(parentItem, menu, path) {
    if (!menu.items) {
      return;
    }

    for (let i=0; i<menu.items.length; i++) {

      let menuItemContainer = new St.Widget({
        layout_manager: new Clutter.BinLayout(),
        width: ITEM_SIZE,
        height: ITEM_SIZE
      });

      // create background --------------------------------------------------------------
      // as separate actor since it has to be made transparent when submenu is collapsed

      // let background = new St.Widget({
      //   style_class: 'modal-dialog'
      //   // x_expand: true,
      //   // y_expand: true
      // });

      // menuItemContainer.add_child(background);
      
      // create container for all submenu items -----------------------------------------

      let childItemContainer = new St.Widget({
        style_class: 'modal-dialog tile-menu-child-container'
      });

      menuItemContainer.add_child(childItemContainer);

      // create container for name label and icon ---------------------------------------

      let name = menu.items[i].name ? menu.items[i].name : 'No Name';
      let icon = menu.items[i].icon ? menu.items[i].icon : 'No Icon';

      let iconActor = new St.Icon({
        gicon: Gio.Icon.new_for_string(icon),
        style_class: 'tile-menu-item-icon',
        icon_size: ICON_SIZE,
        opacity: SUB_ICON_OPACITY,
        x_expand: true,
        y_expand: true,
        x_align: Clutter.ActorAlign.CENTER,
        y_align: Clutter.ActorAlign.START
      });

      let labelActor = new St.Label({ 
        style_class: 'tile-menu-item-label',
        text: name,
        opacity: SUB_LABEL_OPACITY,
        x_expand: true,
        y_expand: true,
        x_align: Clutter.ActorAlign.CENTER,
        y_align: Clutter.ActorAlign.END
      });

      menuItemContainer.add_child(iconActor);
      menuItemContainer.add_child(labelActor);

      // create main button ------------------------------------------------------------- 

      let button = new St.Button({
        style_class: 'popup-menu-item tile-menu-item-button',
        reactive: false
      });

      button.connect('notify::hover', Lang.bind(this, this._onItemHover));
      button.connect('clicked', Lang.bind(this, this._onItemClicked));

      button.set_child(menuItemContainer);

      button.childItemContainer = childItemContainer;
      button.labelActor = labelActor;
      button.iconActor = iconActor;
      button.path = path + '/' + i;
      button.parentItem = parentItem;

      parentItem.add_child(button);

      this._createMenuItems(button.childItemContainer, menu.items[i], button.path);
    }
  },

  _getSubMenuSize : function(childItemContainer) {
    let columns = this._getColumnCount(childItemContainer);
    return columns * ITEM_SIZE + (columns-1) * ITEM_SPACING;
  },

  _getSubMenuCollapsedScale : function(childItemContainer) {
    // todo: this does not work well with various themes
    let theme = childItemContainer.get_theme_node();
    let margin = theme.get_margin(St.Side.LEFT);

    let subMenuSize = this._getSubMenuSize(childItemContainer);
    return (ITEM_SIZE-2*margin) / subMenuSize;
  },

  _getColumnCount : function(childItemContainer) {
    let count = childItemContainer.get_children().length;
    if (count == 0) {
      return 0;
    }
    return Math.ceil(Math.sqrt(count));
  },

  _getRowCount : function(childItemContainer) {
    let count = childItemContainer.get_children().length;
    if (count == 0) {
      return 0;
    }
    return Math.ceil(this._getColumnCount()/count);
  },

  _updateMenuItemPositions : function(childItemContainer) {
    let items = childItemContainer.get_children();

    if (items.length == 0) {
      return;
    }

    let columns = this._getColumnCount(childItemContainer);

    // distribute children in a square --- if that's not possible, try to make
    // the resulting shape in x direction larger than in y direction
    for (let i=0; i<items.length; i++) {
      this._updateMenuItemPositions(items[i].childItemContainer);

      items[i].set_position(
        (i%columns) * (ITEM_SIZE + ITEM_SPACING),
        (Math.floor(i/columns)) * (ITEM_SIZE + ITEM_SPACING), 0
      );
    }

    // scale down sub menu items
    if (childItemContainer != this._window.childItemContainer) {
      let scale = this._getSubMenuCollapsedScale(childItemContainer);
      childItemContainer.set_scale(scale, scale);
    }
  },

  _updateMenuOpacity : function() {
    // set opacity of main menu
    let menus = [this._window.childItemContainer];

    // and all open sub menus
    for (let i=0; i<this._openSubMenus.length; i++) {
      menus.push(this._openSubMenus[i].childItemContainer);
    }

    let tween = function(actor, opacity) {
      // actor.opacity = opacity;
      Tweener.addTween(actor, {
        time: 0.5, transition: 'ease', opacity: opacity
      });
    };

    for (let i=0; i<menus.length; i++) {
      let items = menus[i].get_children();
      for (let j=0; j<items.length; j++) {

        if (i == menus.length-1) {
          tween(items[j].labelActor, ACTIVE_LABEL_OPACITY);
          tween(items[j].iconActor, ACTIVE_ICON_OPACITY);
        } else {
          tween(items[j].labelActor, INACTIVE_LABEL_OPACITY);
          tween(items[j].iconActor, INACTIVE_ICON_OPACITY);
        }

        let subs = items[j].childItemContainer.get_children();
        for (let s=0; s<subs.length; s++) {
          tween(subs[s].labelActor, SUB_LABEL_OPACITY);
          tween(subs[s].iconActor, SUB_ICON_OPACITY);
        }
      }
    }
  },

  _updateMenuReactiveness : function() {
    // set responsiveness of main menu
    let menus = [this._window.childItemContainer];

    // and all open sub menus
    for (let i=0; i<this._openSubMenus.length; i++) {
      menus.push(this._openSubMenus[i].childItemContainer);
    }

    for (let i=0; i<menus.length; i++) {
      let items = menus[i].get_children();
      for (let j=0; j<items.length; j++) {
        items[j].reactive = (i == menus.length-1);

        let subs = items[j].childItemContainer.get_children();
        for (let s=0; s<subs.length; s++) {
          subs[s].reactive = false;
        }
      }
    }
  },

  // _updateMenuDepth : function() {
  //   Tweener.addTween(this._window, {
  //     time: 0.3, transition: 'easeOutBack',
  //     z_position: -DEPTH_SPACING * this._openSubMenus.length
  //   });

  //   for (let i=0; i<this._openSubMenus.length; i++) {
  //     let items = this._openSubMenus[i].childItemContainer.get_children();
  //     for (let j=0; j<items.length; j++) {
  //       items[j].childItemContainer.z_position = 0;
  //     }
  //     Tweener.addTween(this._openSubMenus[i].childItemContainer, {
  //       time: 0.3, transition: 'easeOutBack',
  //       z_position: DEPTH_SPACING
  //     });
  //   }
  // },

  _onItemHover : function(button) {
    if (button.hover) {
      button.add_style_class_name('selected');
      button.grab_key_focus();
    } else {
      button.remove_style_class_name('selected');
      button.remove_style_pseudo_class('active');
    }
  },

  _onItemClicked : function(item) {
    if (item.childItemContainer.get_children().length > 0) {
      let size = this._getSubMenuSize(item.childItemContainer);
      let margin = item.childItemContainer.get_theme_node().get_margin(St.Side.LEFT);
      let offset = (-size+ITEM_SIZE)*0.5-margin;

      let [worldX, worldY] = item.childItemContainer.get_transformed_position();
      let [clampedX, clampedY] = this._clampToToMonitor(worldX+offset, worldY+offset, 
                                                        size, size, MONITOR_MARGIN);
      Tweener.addTween(item.childItemContainer, {
        time: 0.3,
        transition: 'easeInOutBack',
        scale_x: 1, scale_y: 1,
        translation_x: clampedX - worldX,
        translation_y: clampedY - worldY
      });

      item.parentItem.set_child_above_sibling(item, null);

      this._openSubMenus.push(item);

      this._updateMenuOpacity();
      this._updateMenuReactiveness();
      // this._updateMenuDepth();

      Tweener.addTween(item.labelActor, {
        time: 0.5, transition: 'ease', opacity: 0
      });

      Tweener.addTween(item.iconActor, {
        time: 0.5, transition: 'ease', opacity: 0
      });

    } else {
      this._hideAll();
      this._onSelect(item.path);
    }
  },

  _onButtonRelease : function(actor, event) {
    if ((actor == this._background.actor && event.get_button() == 1) || event.get_button() == 3) {
      if (this._hideLevel()) {
        this._onCancel();
      }
    } 
    return Clutter.EVENT_STOP;
  },

  _onKeyRelease : function(actor, event) {
    if (event.get_key_symbol() == Clutter.Escape) {
      if (this._hideLevel()) {
        this._onCancel();
      }
    }
    return Clutter.EVENT_STOP;
  }

});
