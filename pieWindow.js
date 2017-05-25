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
const St             = imports.gi.St;
const Tweener        = imports.ui.tweener;

const Me = ExtensionUtils.getCurrentExtension();

const HotCorner     = Me.imports.hotCorner.HotCorner;

const PieWindow = new Lang.Class({
  Name : 'PieWindow',

  _init : function(monitor) {
    
    this._hotCorner = new HotCorner();

    this._background = new St.Widget({
      style_class: 'pie-background',
      height: monitor.height,
      width: monitor.width,
      reactive: true,
      can_focus: true,
      track_hover: true
    });

    this._pieContainer = new St.Widget({
      style_class : 'modal-dialog',
      width: 180,
      height: 180
    });

    this._background.add_actor(this._pieContainer);

    this._background.connect('motion-event', Lang.bind(this, this._onMouseMove));
    this._background.connect('button-press-event', Lang.bind(this, this._onButtonPress));
    this._background.connect('button-release-event', Lang.bind(this, this._onButtonRelease));
    this._background.connect('key-press-event', Lang.bind(this, this._onKeyPress));
    this._background.connect('key-release-event', Lang.bind(this, this._onKeyRelease));
  },

  show : function() {
    if (this._background.visible) {
      return;
    }

    Main.layoutManager.addChrome(this._background);

    this._background.opacity = 0;
    this._background.visible = true;
    this._background.grab_key_focus();

    this._hotCorner.disable();

    Tweener.addTween(this._background, {
      time: 0.2,
      transition: "easeOutQuad",
      opacity: 255
    });
  },

  hide : function(immediate) {
    if (!this._background.visible) {
      return;
    }

    this._hotCorner.enable();

    Tweener.addTween(this._background, {
      time: 0.2,
      transition: "easeOutQuad",
      opacity: 0,
      onComplete: Lang.bind(this, function () {
        Main.layoutManager.removeChrome(this._background);
        this._background.visible = false;
      })
    });
  },

  toggle : function() {
    if (this._background.visible) {
      this.hide();
    } else {
      this.show();
    }
  },

  _onMouseMove : function(actor, event) {
    let absX, absY;
    [absX, absY] = event.get_coords();
    this._pieContainer.translation_x = absX - 40;
    this._pieContainer.translation_y = absY - 40;
  },

  _onButtonPress : function(actor, event) {
    log("gnomepie: _onButtonPress");
  },

  _onKeyPress : function(actor, event) {
    log("gnomepie: _onKeyPress");
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
  },

  destroy : function() {
    this.hide();
  }
});
