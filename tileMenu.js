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
const ITEM_MARGIN    = 0;
const ICON_SIZE      = 80;
const ITEM_SIZE      = 110;


const TileMenu = new Lang.Class({
  Name : 'TileMenu',

  // ----------------------------------------------------------- constructor / destructor

  _init : function(onSelect, onCancel) {

    this._onSelect = onSelect;
    this._onCancel = onCancel;

    this._background = new Background();

    this._window = new St.Widget({
      style_class : 'popup-menu modal-dialog tile-menu-modal'
    });

    this._rootItemContainer = new St.Widget({
      style_class : 'tile-menu-item-container'
    });

    this._window.set_pivot_point(0.5, 0.5);

    this._background.actor.add_child(this._window);
    this._window.add_child(this._rootItemContainer);

    this._background.actor.connect('button-release-event', 
                                   Lang.bind(this, this._onButtonRelease));
    this._background.actor.connect('key-release-event', 
                                   Lang.bind(this, this._onKeyRelease));
    this._window.connect('button-release-event', 
                                   Lang.bind(this, this._onButtonRelease));
  },

  destroy : function() {
    this._background.destroy();
  },

  // ------------------------------------------------------------------- public interface

  show : function(menu) {

    this._rootItemContainer.remove_all_children();
    
    this._createMenuItems(this._rootItemContainer, menu, '');
    this._updateMenuItemPositions(this._rootItemContainer);
    this._updateMenuOpacity(this._rootItemContainer);

    // display the background actor
    if (!this._background.show()) {
      // something went wrong, most likely we failed to get the pointer grab
      return false;
    }

    // calculate window position 
    let [pointerX, pointerY, mods] = global.get_pointer();
    let monitor = Main.layoutManager.currentMonitor;

    let halfWindowWidth = this._window.width/2;
    let halfWindowHeight = this._window.height/2;

    let minX = MONITOR_MARGIN + halfWindowWidth;
    let minY = MONITOR_MARGIN + halfWindowHeight;

    let maxX = monitor.width - MONITOR_MARGIN - halfWindowWidth;
    let maxY = monitor.height - MONITOR_MARGIN - halfWindowHeight;

    let posX = Math.min(Math.max(pointerX, minX), maxX);
    let posY = Math.min(Math.max(pointerY, minY), maxY);
    
    this._window.set_position(Math.floor(posX-halfWindowWidth), 
                              Math.floor(posY-halfWindowHeight));

    // TODO: do pointer warp ... 
    // Is there a better way of doing this? can this be done on wayland?
    // let pointer = global.gdk_screen.get_display().get_default_seat().get_pointer();
    // pointer.warp(global.gdk_screen, posX, posY);

    // add an animation for the window scale
    this._window.set_scale(0.5, 0.5);
    Tweener.addTween(this._window, {
      time: 0.2,
      transition: 'easeOutBack',
      scale_x: 1,
      scale_y: 1
    });

    return true;
  },

  hide : function() {
    Tweener.addTween(this._window, {
      time: 0.2,
      transition: 'easeInBack',
      scale_x: 0.5,
      scale_y: 0.5
    });

    return this._background.hide();
  },

  // ---------------------------------------------------------------------- private stuff

  _createMenuItems : function(parentItem, menu, path) {
    if (!menu.items) {
      return;
    }

    for (let i=0; i<menu.items.length; i++) {

      let menuItemContainer = new St.Widget({
        style_class: 'tile-menu-item-container',
        layout_manager: new Clutter.BinLayout()
      });

      // create container for all submenu items -----------------------------------------

      let childItemContainer = new St.Widget({
        style_class: 'tile-menu-child-container'
      });

      menuItemContainer.add_child(childItemContainer);

      // create container for name label and icon ---------------------------------------

      let name = menu.items[i].name ? menu.items[i].name : 'No Name';
      let icon = menu.items[i].icon ? menu.items[i].icon : 'No Icon';

      let iconActor = new St.Icon({
        gicon: Gio.Icon.new_for_string(icon),
        style_class: 'tile-menu-item-icon',
        icon_size: ICON_SIZE,
        x_expand: true,
        y_expand: true,
        x_align: Clutter.ActorAlign.CENTER,
        y_align: Clutter.ActorAlign.START
      });

      let labelActor = new St.Label({ 
        style_class: 'tile-menu-item-label',
        text: name,
        x_expand: true,
        y_expand: true,
        x_align: Clutter.ActorAlign.FILL,
        y_align: Clutter.ActorAlign.END
      });

      menuItemContainer.add_child(iconActor);
      menuItemContainer.add_child(labelActor);

      // create main button ------------------------------------------------------------- 

      let button = new St.Button({
        style_class: 'popup-menu-item tile-menu-item-button',
        reactive: true,
        track_hover: true,
        width: ITEM_SIZE,
        height: ITEM_SIZE
      });

      button.connect('notify::hover', Lang.bind(this, this._onItemHover));
      button.connect('clicked', Lang.bind(this, this._onItemClicked));

      button.set_child(menuItemContainer);

      button.childItemContainer = childItemContainer;
      button.itemPath = path + '/' + i;

      parentItem.add_child(button);

      this._createMenuItems(button.childItemContainer, menu.items[i], button.itemPath);
    }
  },

  _getColumnCount : function(itemContainer) {
    let count = itemContainer.get_children().length;
    if (count == 0) {
      return 0;
    }
    return Math.ceil(Math.sqrt(count));
  },

  _getRowCount : function(itemContainer) {
    let count = itemContainer.get_children().length;
    if (count == 0) {
      return 0;
    }
    return Math.ceil(this._getColumnCount()/count);
  },

  _updateMenuItemPositions : function(itemContainer) {
    let items = itemContainer.get_children();

    if (items.length == 0) {
      return;
    }

    let columns = this._getColumnCount(itemContainer);

    // distribute children in a square --- if that's not possible, try to make
    // the resulting shape in x direction larger than in y direction
    for (let i=0; i<items.length; i++) {
      this._updateMenuItemPositions(items[i].childItemContainer);

      items[i].set_position(
        i%columns * (ITEM_SIZE + ITEM_MARGIN),
        Math.floor(i/columns) * (ITEM_SIZE + ITEM_MARGIN), 0
      );
    }


    if (itemContainer != this._rootItemContainer) {
      // todo: this does not work well with various themes
      let theme = itemContainer.get_parent().get_theme_node();
      let gap = theme.get_margin(St.Side.LEFT);

      debug(itemContainer.get_parent().get_parent().name + ' ' + items.length + ' ' + columns);
      let subMenuSize = columns * ITEM_SIZE + (columns-1) * ITEM_MARGIN;
      let scale = (ITEM_SIZE-2*gap) / subMenuSize;
      itemContainer.set_scale(scale, scale);
      debug(subMenuSize + ' ' + scale);
    }
  },

  _updateMenuOpacity : function(itemContainer) {
    if (itemContainer != this._rootItemContainer) {
      itemContainer.opacity = 50;
    }
    
    let items = itemContainer.get_children();
    for (let i=0; i<items.length; i++) {
      this._updateMenuOpacity(items[i].childItemContainer);
    }
  },

  _onItemHover : function(actor) {
    if (actor.hover) {
      actor.add_style_class_name('selected');
      actor.grab_key_focus();
    } else {
      actor.remove_style_class_name('selected');
      actor.remove_style_pseudo_class('active');
    }
  },

  _onItemClicked : function(actor) {
    this.hide();
    this._onSelect(actor.itemPath);
  },

  _onButtonRelease : function(actor, event) {
    if ((actor == this._background.actor && event.get_button() == 1) || event.get_button() == 3) {
      this.hide();
      this._onCancel();
    } 
    return Clutter.EVENT_STOP;
  },

  _onKeyRelease : function(actor, event) {
    if (event.get_key_symbol() == Clutter.Escape) {
      this.hide();
      this._onCancel();
    }
    return Clutter.EVENT_STOP;
  }

});
