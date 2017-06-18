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
const ICON_SIZE      = 60;
const ITEM_SIZE      = 90;

const TileMenu = new Lang.Class({
  Name : 'TileMenu',

  // ----------------------------------------------------------- constructor / destructor

  _init : function(onSelect, onCancel) {

    this._onSelect = onSelect;
    this._onCancel = onCancel;

    this._background = new Background(new Clutter.Color({
        red: 0, green: 0, blue: 0, alpha: 90
    }));

    this._rootMenu = new St.Bin({
      style_class : 'popup-menu modal-dialog tile-menu-modal',
      reactive: true
    });

    this._rootMenu.set_pivot_point(0.5, 0.5);

    this._background.actor.add_actor(this._rootMenu);

    this._background.actor.connect('button-release-event', 
                                   Lang.bind(this, this._onButtonRelease));
    this._background.actor.connect('key-release-event', 
                                   Lang.bind(this, this._onKeyRelease));
    this._rootMenu.connect('button-release-event', 
                                   Lang.bind(this, this._onButtonRelease));
  },

  destroy : function() {
    this._background.destroy();
  },

  // ------------------------------------------------------------------- public interface

  show : function(menu) {

    this._rootMenu.remove_all_children();
    this._rootMenu.itemContainer = null;
    this._rootMenu.itemPath = '';
    
    this._createMenuItems(this._rootMenu, menu);
    this._updateMenuItemPositions(this._rootMenu);

    // display the background actor
    if (!this._background.show()) {
      // something went wrong, most likely we failed to get the pointer grab
      return false;
    }

    // calculate window position 
    let [pointerX, pointerY, mods] = global.get_pointer();
    let monitor = Main.layoutManager.currentMonitor;

    let halfWindowWidth = this._rootMenu.width/2;
    let halfWindowHeight = this._rootMenu.height/2;

    let minX = MONITOR_MARGIN + halfWindowWidth;
    let minY = MONITOR_MARGIN + halfWindowHeight;

    let maxX = monitor.width - MONITOR_MARGIN - halfWindowWidth;
    let maxY = monitor.height - MONITOR_MARGIN - halfWindowHeight;

    let posX = Math.min(Math.max(pointerX, minX), maxX);
    let posY = Math.min(Math.max(pointerY, minY), maxY);
    
    this._rootMenu.set_position(Math.floor(posX-halfWindowWidth), 
                              Math.floor(posY-halfWindowHeight));

    // TODO: do pointer warp ... 
    // Is there a better way of doing this? can this be done on wayland?
    // let pointer = global.gdk_screen.get_display().get_default_seat().get_pointer();
    // pointer.warp(global.gdk_screen, posX, posY);

    // add an animation for the window scale
    this._rootMenu.set_scale(0.5, 0.5);
    Tweener.addTween(this._rootMenu, {
      time: 0.2,
      transition: 'easeOutBack',
      scale_x: 1,
      scale_y: 1
    });

    return true;
  },

  hide : function() {
    Tweener.addTween(this._rootMenu, {
      time: 0.2,
      transition: 'easeInBack',
      scale_x: 0.5,
      scale_y: 0.5
    });

    return this._background.hide();
  },

  // ---------------------------------------------------------------------- private stuff

  _createMenuItems : function(parent, menu) {
    if (menu.items) {

      if (!parent.itemContainer) {
        parent.itemContainer = new St.Widget({
          style_class : 'popup-menu-content tile-menu-content'
        });
        parent.add_actor(parent.itemContainer, {x_fill:true, y_fill:true});
      }

      let i = 0;

      for (let item of menu.items) {
        let button = this._createButton(item);
        button.itemPath = parent.itemPath + '/' + i;

        this._createMenuItems(button, item);
        parent.itemContainer.add_actor(button);

        ++i;
      }
    }
  },

  _createButton : function(menu) {
    let name = menu.name ? menu.name : 'No Name';
    let icon = menu.icon ? menu.icon : 'No Icon';

    let gicon = Gio.Icon.new_for_string(icon);

    let iconActor = new St.Icon({
      gicon: gicon,
      style_class: 'tile-menu-item-icon',
      icon_size: ICON_SIZE
    });

    let labelActor = new St.Label({ 
      style_class: 'tile-menu-item-label',
      text: name
    });

    let item = new St.BoxLayout({ 
      vertical: true
    });

    item.add(iconActor);
    item.add(labelActor);

    let button = new St.Button({
      style_class: 'popup-menu-item tile-menu-item-button',
      reactive: true,
      track_hover: true,
      width: ITEM_SIZE,
      height: ITEM_SIZE
    });

    button.connect('notify::hover', Lang.bind(this, this._onItemHover));
    button.connect('clicked', Lang.bind(this, this._onItemClicked));

    button.set_child(item);

    return button;
  },

  _getColumnCount : function(menu) {
    let count = menu.itemContainer.get_children().length;
    if (count == 0) {
      return 0;
    }
    return Math.ceil(Math.sqrt(count));
  },

  _getRowCount : function(menu) {
    let count = menu.itemContainer.get_children().length;
    if (count == 0) {
      return 0;
    }
    return Math.ceil(this._getColumnCount()/count);
  },

  _updateMenuItemPositions : function(menu) {
    if (!menu.itemContainer) {
      return;
    }

    let items = menu.itemContainer.get_children();
    let columns = this._getColumnCount(menu);

    // distribute children in a square --- if that's not possible, try to make
    // the resulting shape in x direction larger than in y direction
    for (let i=0; i<items.length; i++) {
      this._updateMenuItemPositions(items[i]);

      items[i].set_position(
        i%columns * (ITEM_SIZE + ITEM_MARGIN),
        Math.floor(i/columns) * (ITEM_SIZE + ITEM_MARGIN), 0
      );
    }

    if (menu != this._rootMenu) {
      let themeNode = menu.get_theme_node();
      let padding = themeNode.get_padding(St.Side.LEFT);

      let subMenuSize = menu.itemContainer.width;
      let scale = (ITEM_SIZE-2*padding) / subMenuSize;
      menu.itemContainer.set_scale(scale, scale);
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
