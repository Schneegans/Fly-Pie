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
    this._window.subMenus = [];

    this._loadTheme();

    this._createMenuItems(this._window, menu, '');
    this._updateMenuItemPositions(this._window);

    this._updateMenuOpacity();
    this._updateMenuReactiveness();
    this._updateMenuDepth();

    // display the background actor
    if (!this._background.show()) {
      // something went wrong, most likely we failed to get the pointer grab
      return false;
    }

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

    return true;
  },

  _loadTheme : function() {
    let switcherStyle = this._window.subMenuContainer.get_theme_node();

    this._theme.animationSpeed       = 1.0;
    this._theme.menuPadding          = switcherStyle.get_padding(St.Side.LEFT);
    this._theme.itemSpacing          = 4;
    this._theme.itemPadding          = 6;
    this._theme.monitorPadding       = 8;
    this._theme.iconSize             = 100;
    this._theme.itemSize             = 130;
    this._theme.depthSpacing         = 50;
    this._theme.activeItemOpacity    = 255;
    this._theme.activeIconOpacity    = 255;
    this._theme.activeLabelOpacity   = 255;
    this._theme.inactiveItemOpacity  = 100;
    this._theme.inactiveIconOpacity  = 255;
    this._theme.inactiveLabelOpacity = 255;
    this._theme.subItemOpacity       = 100;
    this._theme.subIconOpacity       = 150;
    this._theme.subLabelOpacity      = 0;
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

      this._updateMenuOpacity();
      this._updateMenuReactiveness();
      this._updateMenuDepth();

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

    for (let i=0; i<description.items.length; i++) {

      let menu = new St.Widget({
        style_class: "item-box",
        track_hover: true,
        width: this._theme.itemSize,
        height: this._theme.itemSize,
        opacity: 0
      });
      
      // create container for all submenu items ------------------------------------------

      let subMenuContainer = new St.Widget({
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
        icon_size: this._theme.iconSize,
        opacity: this._theme.subIconOpacity,
        x: (this._theme.itemSize - this._theme.iconSize)*0.5,
        y: this._theme.itemPadding
      });

      menu.color = getIconColor(Gio.Icon.new_for_string(iconName));
      menu.style = "background-color: rgba(" + menu.color.red + ", " + menu.color.green + ", " + menu.color.blue + ", 0.3)";

      let label = new St.Label({ 
        text: labelText,
        opacity: this._theme.subLabelOpacity
      });

      let labelBox = new St.Widget({
        layout_manager: new Clutter.BinLayout(),
        width: this._theme.itemSize-2*this._theme.itemPadding,
        x: this._theme.itemPadding
      });

      menu.add_child(icon);
      menu.add_child(labelBox);
      labelBox.add_child(label);

      // create main button -------------------------------------------------------------- 

      menu.connect('notify::hover', Lang.bind(this, this._onItemHover));
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
    for (let i=0; i<menu.subMenus.length; i++) {
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

  _updateMenuOpacity : function() {
    let tween = function(actor, opacity) {
      Tweener.addTween(actor, { 
        time: 0.5 * this._theme.animationSpeed, transition: 'ease', opacity: opacity 
      });
    };

    // update opacity of all open menus and their children
    for (let i=0; i<this._openMenus.length; i++) {

      let subMenus = this._openMenus[i].subMenus;

      for (let j=0; j<subMenus.length; j++) {
        if (i == this._openMenus.length-1) {
          Lang.bind(this, tween)(subMenus[j].label, this._theme.activeLabelOpacity);
          Lang.bind(this, tween)(subMenus[j].icon, this._theme.activeIconOpacity);
          Lang.bind(this, tween)(subMenus[j].background, 0);
          Lang.bind(this, tween)(subMenus[j], this._theme.activeItemOpacity);
        } else {
          Lang.bind(this, tween)(subMenus[j].label, this._theme.inactiveLabelOpacity);
          Lang.bind(this, tween)(subMenus[j].icon, this._theme.inactiveIconOpacity);
          Lang.bind(this, tween)(subMenus[j], this._theme.inactiveItemOpacity);
        }

        let subs = subMenus[j].subMenus;
        for (let s=0; s<subs.length; s++) {
          Lang.bind(this, tween)(subs[s].label, this._theme.subLabelOpacity);
          Lang.bind(this, tween)(subs[s].icon, this._theme.subIconOpacity);
          Lang.bind(this, tween)(subs[s], this._theme.subItemOpacity);
        }
      }

      if (i > 0) {
        // hide the label and a icon of the top most menu but show its background 
        Lang.bind(this, tween)(this._openMenus[i].label, 0);
        Lang.bind(this, tween)(this._openMenus[i].icon, 0);
        Lang.bind(this, tween)(this._openMenus[i].background, this._theme.activeItemOpacity);
        Lang.bind(this, tween)(this._openMenus[i], this._theme.activeItemOpacity);
      }
    }
  },

  _updateMenuReactiveness : function() {
    for (let i=0; i<this._openMenus.length; i++) {
      let items = this._openMenus[i].subMenus;
      for (let j=0; j<items.length; j++) {
        items[j].reactive = (i == this._openMenus.length-1);

        let subs = items[j].subMenus;
        for (let s=0; s<subs.length; s++) {
          subs[s].reactive = false;
        }
      }
    }
  },

  _updateMenuDepth : function() {
    let tween = function(actor, depth) {
      Tweener.addTween(actor, { 
        time: 0.2 * this._theme.animationSpeed, transition: 'easeInOutCubic', z_position: depth 
      });
    };

    for (let i=0; i<this._openMenus.length; i++) {
      if (i == 0) {
        Lang.bind(this, tween)(this._openMenus[i].subMenuContainer, -this._theme.depthSpacing * (this._openMenus.length-1));
      } else {
        Lang.bind(this, tween)(this._openMenus[i].subMenuContainer, this._theme.depthSpacing);
      }

      if (i == this._openMenus.length-1) {
        let items = this._openMenus[i].subMenus;
        for (let j=0; j<items.length; j++) {
          Lang.bind(this, tween)(items[j].subMenuContainer, 0);
        }
      }
    }
  },

  _onItemHover : function(button) {
    if (button.hover) {
      debug("hover");
      let color = button.color.lighten();
      // button.style = "background-color: rgba(" + color.red + ", " + color.green + ", " + color.blue + ", 0.4)";
      button.style = "background-color: rgba(" + button.color.red + ", " + button.color.green + ", " + button.color.blue + ", 0.5)";
      button.grab_key_focus();
    } else {
      button.style = "background-color: rgba(" + button.color.red + ", " + button.color.green + ", " + button.color.blue + ", 0.3)";
    }
  },

  _onItemClicked : function(menu, event) {
    if (event.get_button() != 1) {
      return Clutter.EVENT_PROPAGATE;
    }
    
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
        // transition: 'easeOutBack',
        scale_x: 1, scale_y: 1,
        translation_x: clampedX - worldX,
        translation_y: clampedY - worldY
      });

      menu.parentItem.subMenuContainer.set_child_above_sibling(menu, null);

      this._openMenus.push(menu);

      this._updateMenuOpacity();
      this._updateMenuReactiveness();
      this._updateMenuDepth();

    } else {
      this._hideAll();
      this._onSelect(menu.path);
    }

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
