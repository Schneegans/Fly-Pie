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

/////////////////////////////////////////////////////////////////////////////////////////
// The Background is a fullscreen modal actor which effectively capture the entire     //
// user input.                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////

const Background = new Lang.Class({
  Name : 'Background',

  // ----------------------------------------------------------- constructor / destructor

  // Creates the initially invisible background actor.
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

  // Removes the background without any animation.
  destroy : function() {
    Main.uiGroup.remove_actor(this.actor);
    this.actor = null;
  },

  // ------------------------------------------------------------------- public interface

  // This shows the background, blocking all user input. A subtle animation is used to
  // fade in the background. Returns false if the background failed to grab the input.
  // It will not be shown in this case, if everything worked as supposed, true will be
  // returned.
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

  // This hides the background again. The input will not be grabbed anymore. For now,
  // this function always returns true but this may change in future.
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
