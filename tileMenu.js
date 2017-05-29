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

const Me = ExtensionUtils.getCurrentExtension();

const Background     = Me.imports.background.Background;
const debug          = Me.imports.debug.debug;

const TileMenu = new Lang.Class({
  Name : 'TileMenu',

  // ----------------------------------------------------------- constructor / destructor

  _init : function() {

    this._background = new Background(new Clutter.Color({
        red: 0, blue: 0, green: 0, alpha: 90
    }));
    
    this._pieContainer = new Shell.GenericContainer({
      style_class : 'modal-dialog',
      width: 180,
      height: 180
    });

    this._background.actor.add_actor(this._pieContainer);

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
  },

  destroy : function() {
    this._background.destroy();
  },

  // ------------------------------------------------------------------- public interface

  show : function() {
    return this._background.show();
  },

  hide : function() {
    return this._background.hide();
  },

  // ---------------------------------------------------------------------- private stuff

  _onMouseMove : function(actor, event) {
    let absX, absY;
    [absX, absY] = event.get_coords();
    this._pieContainer.translation_x = absX - 40;
    this._pieContainer.translation_y = absY - 40;
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
