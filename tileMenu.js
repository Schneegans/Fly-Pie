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
const Shell          = imports.gi.Shell;
const Tweener        = imports.ui.tweener;
const St             = imports.gi.St;

const Me = ExtensionUtils.getCurrentExtension();

const Background     = Me.imports.background.Background;
const debug          = Me.imports.debug.debug;

const TileMenu = new Lang.Class({
  Name : 'TileMenu',

  // ----------------------------------------------------------- constructor / destructor

  _init : function() {

    this._background = new Background(new Clutter.Color({
        red: 0, green: 0, blue: 0, alpha: 90
    }));

    this._window = new St.Bin({
      style_class : 'popup-menu modal-dialog tile-menu-modal'
    });

    this._window.set_pivot_point(0.5, 0.5);


    this._menu = new St.Widget({
      style_class : 'popup-menu-content tile-menu-content'
    });


    this._background.actor.add_actor(this._window);

    this._background.actor.connect('motion-event', 
                                   Lang.bind(this, this._onMouseMove));
    this._background.actor.connect('button-press-event', 
                                   Lang.bind(this, this._onButtonPress));
    this._background.actor.connect('button-release-event', 
                                   Lang.bind(this, this._onButtonRelease));
    this._background.actor.connect('key-press-event', 
                                   Lang.bind(this, this._onKeyPress));
    this._background.actor.connect('key-release-event', 
                                   Lang.bind(this, this._onKeyRelease));

    this._addItem("Firefox", "firefox");
    this._addItem("Thunderbird", "thunderbird");
    this._addItem("Gedit", "gedit");
    this._addItem("Rhythmbox bla bla blas asd asf adf sdf sdfds", "rhythmbox");
    this._addItem("Terminal", "terminal");
    this._addItem("Sublime Text", "sublime");
    this._addItem("Nautilus", "nautilus");
    this._addItem("Atom", "atom");

    this._updateItemPositions();
    this._window.add_actor(this._menu, {x_fill:true, y_fill:true});
  },

  destroy : function() {
    this._background.destroy();
  },

  // ------------------------------------------------------------------- public interface

  show : function() {

    // let monitor = Main.layoutManager.primaryMonitor;
    // let size = 380;

    let [x, y, mods] = global.get_pointer();
    this._window.set_position(Math.floor(x-this._window.width/2), Math.floor(y-this._window.height/2));
    this._window.set_scale(0.5, 0.5);

    if (!this._background.show()) {
      return false;
    }

    Tweener.addTween(this._window, {
      time: 0.2,
      transition: "easeOutBack",
      scale_x: 1,
      scale_y: 1
    });

    return true;
  },

  hide : function() {

    Tweener.addTween(this._window, {
      time: 0.2,
      transition: "easeInBack",
      scale_x: 0.5,
      scale_y: 0.5
    });

    return this._background.hide();
  },

  // ---------------------------------------------------------------------- private stuff

  _addItem : function(label, icon) {
    let iconActor = new St.Icon({
      icon_name: icon,
      style_class: 'tile-menu-item-icon',
      icon_size: 90
    });

    let labelActor = new St.Label({ 
      style_class: 'tile-menu-item-label',
      text: label
    });

    let item = new St.BoxLayout({ 
      vertical: true
    });

    item.add(iconActor);
    item.add(labelActor);

    let button = new St.Button({
      style_class: 'popup-menu-item tile-menu-item-button',
      reactive: true,
      track_hover: true
    });

    button.connect('notify::hover', Lang.bind(this, function (actor) {
      if (actor.hover) {
        actor.add_style_class_name('selected');
        actor.grab_key_focus();
      } else {
        actor.remove_style_class_name('selected');
        actor.remove_style_pseudo_class ('active');
      }
    }));

    button.set_child(item);

    this._menu.add_actor(button);
  },

  _getColumnCount : function() {
    let count = this._menu.get_children().length;
    if (count == 0) {
      return 0;
    }
    return Math.ceil(Math.sqrt(count));
  },

  _getRowCount : function() {
    let count = this._menu.get_children().length;
    if (count == 0) {
      return 0;
    }
    return Math.ceil(this._getColumnCount()/count);
  },

  _updateItemPositions : function() {

    let children = this._menu.get_children();
    let columns = this._getColumnCount();

    // distribute children in a square --- if thats not possible, try to make
    // the resulting shape in x direction larger than in y direction
    for (let i=0; i<children.length; i++) {
      children[i].set_position(
        i%columns * 110,
        Math.floor(i/columns) * 130, 0
      );

      // calculate_positions(child);
    }
  },

  _onMouseMove : function(actor, event) {
    // let absX, absY;
    // [absX, absY] = event.get_coords();
    // this._window.translation_x = absX - 40;
    // this._window.translation_y = absY - 40;
  },

  _onButtonPress : function(actor, event) {
    debug("onButtonPress");
  },

  _onKeyPress : function(actor, event) {
    debug("onKeyPress");
  },

  _onButtonRelease : function(actor, event) {
    if (event.get_button() == 3) {
      this.hide();
    } 
    return true;
  },

  _onKeyRelease : function(actor, event) {
    if (event.get_key_symbol() == Clutter.Escape) {
      this.hide();
    }
    return true;
  }

});
