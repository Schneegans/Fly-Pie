//////////////////////////////////////////////////////////////////////////////////////////
//                                                                                      //
//    _____                    ___  _     ___       This software may be modified       //
//   / ___/__  ___  __ _  ___ / _ \(_)__ |_  |      and distributed under the           //
//  / (_ / _ \/ _ \/  ' \/ -_) ___/ / -_) __/       terms of the MIT license. See       //
//  \___/_//_/\___/_/_/_/\__/_/  /_/\__/____/       the LICENSE file for details.       //
//                                                                                      //
//  Authors: Simon Schneegans (code@simonschneegans.de)                                 //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

const Clutter        = imports.gi.Clutter;
const Pango          = imports.gi.Pango;
const ExtensionUtils = imports.misc.extensionUtils;
const Lang           = imports.lang;
const Main           = imports.ui.main;
const Tweener        = imports.ui.tweener;
const St             = imports.gi.St;
const Gio            = imports.gi.Gio;

const Me = ExtensionUtils.getCurrentExtension();

const Background     = Me.imports.background.Background;
const debug          = Me.imports.debug.debug;
const getIconColor   = Me.imports.utils.getIconColor;
const Timer          = Me.imports.timer.Timer;

const TileMenu = new Lang.Class({
  Name : 'TileMenu',

  // ------------------------------------------------------------ constructor / destructor

  _init : function(onSelect, onCancel) {

    this._onSelect = onSelect;
    this._onCancel = onCancel;

    this._background = new Background();
    this._window = new Clutter.Actor();
    this._window.set_pivot_point(0.5, 0.5);
    this._background.actor.add_child(this._window);

    let itemContainer = new St.Widget({
      style_class: "switcher-list"
    });

    this._window.subMenus = [];
    this._window.label = undefined;
    this._window.icon = undefined;
    this._window.background = undefined;
    this._window.subMenuContainer = itemContainer;
    this._window.add_child(itemContainer);

    this._background.actor.connect('button-release-event', 
                                   Lang.bind(this, this._onButtonRelease));
    this._background.actor.connect('key-release-event', 
                                   Lang.bind(this, this._onKeyRelease));
    this._window.connect('button-release-event', 
                                   Lang.bind(this, this._onButtonRelease));
    this._openMenus = [];
    this._theme = {};
  },

  destroy : function() {
    this._background.destroy();
  },

  // -------------------------------------------------------------------- public interface

  show : function(menu) {
    this._openMenus = [this._window];
    this._window.subMenuContainer.remove_all_children();
    this._window.subMenuContainer.depth = 0;
    this._window.subMenus = [];

    this._loadTheme();

    this._createMenuItems(this._window, menu, '');
    this._updateMenuItemPositions(this._window);

    this._updateMenuOpacity(this._window, true);
    this._setChildrenReactiveness(this._window, true);
    
    let timer = new Timer();
    
    // display the background actor
    if (!this._background.show()) {
      // something went wrong, most likely we failed to get the pointer grab
      return false;
    }

    timer.printElapsedAndReset('[M] Show background');

    this._window.subMenuContainer.width = this._getMenuWidth(this._window);
    this._window.subMenuContainer.height = this._getMenuHeight(this._window);

    // calculate window position 
    let [pointerX, pointerY, mods] = global.get_pointer();
    let [posX, posY] = this._clampToToMonitor(pointerX-this._window.width/2, 
                                              pointerY-this._window.height/2, 
                                              this._window.width, this._window.height, 
                                              this._theme.monitorPadding);
    this._window.set_position(posX, posY);

    // add an animation for the window scale
    this._window.set_scale(0.5, 0.5);
    Tweener.addTween(this._window, {
      time: 0.3 * this._theme.animationSpeed,
      transition: 'easeOutBack',
      scale_x: 1, scale_y: 1
    });
    timer.printElapsedAndReset('[M] setup window');

    return true;
  },

  _loadTheme : function() {
    let switcherStyle = this._window.subMenuContainer.get_theme_node();
    let padding = switcherStyle.get_padding(St.Side.LEFT);

    this._theme.animationSpeed            = 1.0;
    this._theme.coloredBackground         = true;
    this._theme.menuPadding               = padding;
    this._theme.itemSpacing               = 4;
    this._theme.itemPadding               = 2;
    this._theme.monitorPadding            = 8;
    this._theme.iconSize                  = 64;
    this._theme.itemSize                  = 90;
    this._theme.depthSpacing              = 50;

    this._theme.activeBackgroundOpacity   = 100;
    this._theme.inactiveBackgroundOpacity = 50;
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
    if (this._openMenus.length > 1) {
      let menu = this._openMenus.pop();
      let scale = this._getMenuCollapsedScale(menu);
      Tweener.addTween(menu.subMenuContainer, {
        time: 0.2 * this._theme.animationSpeed,
        transition: 'easeInOutCubic',
        scale_x: scale, scale_y: scale,
        translation_x: 0, translation_y: 0
      });

      this._updateMenuOpacity(menu, false);
      this._updateMenuDepth(menu, false);
      this._setChildrenReactiveness(menu, false);
      this._setChildrenReactiveness(this._openMenus[this._openMenus.length-1], true);

      return false;
    } else {
      this._hideAll();

      return true;
    }
  },

  _hideAll : function() {
    this._openMenus = [];

    Tweener.addTween(this._window, {
      time: 0.3 * this._theme.animationSpeed,
      transition: 'easeInBack',
      scale_x: 0.5, scale_y: 0.5
    });

    this._background.hide();
  },

  // ----------------------------------------------------------------------- private stuff

  _createMenuItems : function(parentItem, description, path) {
    if (!description.items) {
      return;
    }

    let count = description.items.length;
    for (let i=0; i<count; i++) {

      let menu = new Clutter.Actor({
        width:    this._theme.itemSize,
        height:   this._theme.itemSize,
        reactive: false
      });
      
      // create container for all submenu items ------------------------------------------
      let subMenuContainer = new Clutter.Actor({
        x: this._theme.itemPadding,
        y: this._theme.itemPadding
      });

      menu.add_child(subMenuContainer);

      // create background ---------------------------------------------------------------
      // as separate actor since it has to be made transparent when submenu is collapsed
      let background = new St.Widget({
        style_class: "switcher-list",
        opacity: 0
      });

      subMenuContainer.add_child(background);

      // create container for name label and icon ----------------------------------------
      let labelText = description.items[i].name ? description.items[i].name : 'No Name';
      let iconName = description.items[i].icon ? description.items[i].icon : 'No Icon';

      let icon = new St.Icon({
        gicon: Gio.Icon.new_for_string(iconName),
        fallback_icon_name: "image-missing",
        icon_size: this._theme.iconSize,
        x: (this._theme.itemSize - this._theme.iconSize)*0.5,
        y: this._theme.itemPadding,
        opacity: 0
      });

      if (this._theme.coloredBackground) {
        let color = getIconColor(Gio.Icon.new_for_string(iconName));
        menu.background_color = new Clutter.Color({red:   color.red,
                                                   green: color.green,
                                                   blue:  color.blue,
                                                   alpha: this._theme.inactiveBackgroundOpacity});
      } else {
        menu.background_color = new Clutter.Color({red:   255,
                                                   green: 255,
                                                   blue:  255,
                                                   alpha: this._theme.inactiveBackgroundOpacity});
      }

      let label = new St.Label({ 
        text: labelText,
        opacity: 0,
        style: "font-size: 80%"
      });

      let labelBox = new Clutter.Actor({
        layout_manager: new Clutter.BinLayout(),
        width: this._theme.itemSize-2*this._theme.itemPadding,
        x: this._theme.itemPadding
      });

      menu.add_child(icon);
      menu.add_child(labelBox);
      labelBox.add_child(label);

      // create main button -------------------------------------------------------------- 
      menu.connect('enter-event', Lang.bind(this, this._onItemEnter));
      menu.connect('leave-event', Lang.bind(this, this._onItemLeave));
      menu.connect('button-release-event', Lang.bind(this, this._onItemClicked));

      menu.subMenus = [];
      menu.subMenuContainer = subMenuContainer;
      menu.label = label;
      menu.icon = icon;
      menu.path = path + '/' + i;
      menu.parentItem = parentItem;
      menu.background = background;

      parentItem.subMenuContainer.add_child(menu);
      parentItem.subMenus.push(menu);

      this._createMenuItems(menu, description.items[i], menu.path);

      background.width = this._getMenuWidth(menu);
      background.height = this._getMenuHeight(menu);
      labelBox.y = this._theme.itemSize - label.height - this._theme.itemPadding;
    }
  },

  _getMenuWidth : function(menu) {
    let columns = this._getColumnCount(menu);
    return columns * this._theme.itemSize + (columns-1) * this._theme.itemSpacing + 2 * this._theme.menuPadding;
  },

  _getMenuHeight : function(menu) {
    let columns = this._getRowCount(menu);
    return columns * this._theme.itemSize + (columns-1) * this._theme.itemSpacing + 2 * this._theme.menuPadding;
  },

  _getMenuCollapsedScale : function(menu) {
    let subMenuSize = this._getMenuWidth(menu);
    return (this._theme.itemSize-2*this._theme.itemPadding) / subMenuSize;
  },

  _getColumnCount : function(menu) {
    let count = menu.subMenus.length;
    if (count == 0) {
      return 0;
    }
    return Math.ceil(Math.sqrt(count));
  },

  _getRowCount : function(menu) {
    let count = menu.subMenus.length;
    if (count == 0) {
      return 0;
    }
    return Math.ceil(count/this._getColumnCount(menu));
  },

  _updateMenuItemPositions : function(menu) {
    if (menu.subMenus.length == 0) {
      return;
    }

    let columns = this._getColumnCount(menu);

    // distribute children in a square --- if that's not possible, try to make
    // the resulting shape in x direction larger than in y direction
    let count = menu.subMenus.length;
    for (let i=0; i<count; i++) {
      this._updateMenuItemPositions(menu.subMenus[i]);

      menu.subMenus[i].set_position(
        (i%columns) * (this._theme.itemSize + this._theme.itemSpacing) + this._theme.menuPadding,
        (Math.floor(i/columns)) * (this._theme.itemSize + this._theme.itemSpacing) + this._theme.menuPadding, 0
      );
    }

    // scale down sub menu items
    if (menu != this._window) {
      let scale = this._getMenuCollapsedScale(menu);
      menu.subMenuContainer.set_scale(scale, scale);
    }
  },

  _updateMenuOpacity : function(menu, open) {
    let speed = this._theme.animationSpeed;

    let tween = function(actor, opacity) {
      if (actor) {
        Tweener.addTween(actor, { 
          time: 0.5 * speed, transition: 'ease', opacity: opacity 
        });
      }
    };

    tween(menu.label, open ? 0 : 255);
    tween(menu.icon, open ? 0 : 255);
    tween(menu.background, open ? 255 : 0);
    
    for (let i=menu.subMenus.length-1; i>=0; i--) {
      tween(menu.subMenus[i].label, open ? 255 : 0);
      tween(menu.subMenus[i].icon, open ? 255 : 0);
    }
  },

  _setChildrenReactiveness : function(menu, reactive) {
    for (let j=menu.subMenus.length-1; j>=0; j--) {
      menu.subMenus[j].reactive = reactive;
    }
  },

  _updateMenuDepth : function(menu, open) {
    let timer = new Timer();
    let tween = function(actor, scale) {
      Tweener.addTween(actor, { time: 0.2 * this._theme.animationSpeed, transition: 'easeInOutCubic', depth: scale });
    };

    Lang.bind(this, tween)(this._openMenus[0].subMenuContainer, -this._theme.depthSpacing * (this._openMenus.length-1));

    if (open) {  
      Lang.bind(this, tween)(menu.subMenuContainer, this._theme.depthSpacing);
    } else {
      Lang.bind(this, tween)(menu.subMenuContainer, 0);
    }

    timer.printElapsedAndReset('[M] Update submenu depth');
  },

  _onItemEnter : function(menu) {
    menu.background_color = new Clutter.Color({red:   menu.background_color.red,
                                               green: menu.background_color.green,
                                               blue:  menu.background_color.blue,
                                               alpha: this._theme.activeBackgroundOpacity});
    menu.grab_key_focus();
  },

  _onItemLeave : function(menu) {
    menu.background_color = new Clutter.Color({red:   menu.background_color.red,
                                               green: menu.background_color.green,
                                               blue:  menu.background_color.blue,
                                               alpha: this._theme.inactiveBackgroundOpacity});
  },

  _onItemClicked : function(menu, event) {
    if (event.get_button() != 1) {
      return Clutter.EVENT_PROPAGATE;
    }

    let timer = new Timer();
    
    if (menu.subMenus.length > 0) {
      let width = this._getMenuWidth(menu);
      let height = this._getMenuHeight(menu);
      let offsetX = (-width+this._theme.itemSize)*0.5-this._theme.itemPadding;
      let offsetY = (-height+this._theme.itemSize)*0.5-this._theme.itemPadding;

      let [worldX, worldY] = menu.subMenuContainer.get_transformed_position();
      let [clampedX, clampedY] = this._clampToToMonitor(worldX+offsetX, worldY+offsetY, 
                                                        width, height, this._theme.monitorPadding);

      Tweener.addTween(menu.subMenuContainer, {
        time: 0.2 * this._theme.animationSpeed,
        transition: 'easeInOutCubic',
        scale_x: 1, scale_y: 1,
        translation_x: clampedX - worldX,
        translation_y: clampedY - worldY
      });

      menu.parentItem.subMenuContainer.set_child_above_sibling(menu, null);

      this._openMenus.push(menu);

      this._setChildrenReactiveness(this._openMenus[this._openMenus.length-2], false);
      this._setChildrenReactiveness(this._openMenus[this._openMenus.length-1], true);
      this._updateMenuOpacity(this._openMenus[this._openMenus.length-1], true);
      this._updateMenuDepth(this._openMenus[this._openMenus.length-1], true);
      
    } else {
      this._hideAll();
      this._onSelect(menu.path);
    }

    timer.printElapsedAndReset('[M] On Click');

    return Clutter.EVENT_STOP;
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
