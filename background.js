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

const Me = ExtensionUtils.getCurrentExtension();

const debug         = Me.imports.debug.debug;

const Background = new Lang.Class({
  Name : 'Background',

  // ----------------------------------------------------------- constructor / destructor

  _init : function(color) {
    
    let monitor = Main.layoutManager.currentMonitor;

    this.actor = new Clutter.Actor({
      height: monitor.height,
      width: monitor.width,
      reactive: true,
      visible: false,
      background_color: color,
    });

    Main.uiGroup.add_actor(this.actor);
  },

  destroy : function() {
    Main.uiGroup.remove_actor(this.actor);
  },

  // ------------------------------------------------------------------- public interface

  show : function() {
    if (this.actor.visible) {
      return true;
    }

    if (!Main.pushModal(this.actor)) {
      return false;
    }

    this.actor.opacity = 0;
    this.actor.visible = true;

    Tweener.addTween(this.actor, {
      time: 0.2,
      transition: "easeOutQuad",
      opacity: 255
    });

    return true;
  },

  hide : function() {
    if (!this.actor.visible) {
      return true;
    }

    Main.popModal(this.actor);

    Tweener.addTween(this.actor, {
      time: 0.2,
      transition: "easeOutQuad",
      opacity: 0,
      onComplete: Lang.bind(this, function () {
        this.actor.visible = false;
      })
    });
    
    return true;
  }

  // ---------------------------------------------------------------------- private stuff

});
