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

'use strict';

const Clutter        = imports.gi.Clutter;
const ExtensionUtils = imports.misc.extensionUtils;
const Main           = imports.ui.main;
const Tweener        = imports.ui.tweener;
const St             = imports.gi.St;

const Me    = ExtensionUtils.getCurrentExtension();
const debug = Me.imports.common.debug.debug;

//////////////////////////////////////////////////////////////////////////////////////////
// The Background is a fullscreen modal actor which effectively captures the entire     //
// user input.                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////

var Background = class Background {

  // ------------------------------------------------------------ constructor / destructor

  // Creates the initially invisible background actor.
  constructor() {
    this.actor = new St.Widget({
      style_class : 'tile-menu-background',
      height : Main.layoutManager.currentMonitor.height,
      width : Main.layoutManager.currentMonitor.width,
      reactive : false,
      visible : false,
      opacity : 0
    });

    Main.uiGroup.add_actor(this.actor);
  }

  // Removes the background without any animation.
  destroy() {
    Main.uiGroup.removeactor(this.actor);
    this.actor = null;
  }

  // -------------------------------------------------------------------- public interface

  // This shows the background, blocking all user input. A subtle animation is used to
  // fade in the background. Returns false if the background failed to grab the input.
  // It will not be shown in this case, if everything worked as supposed, true will be
  // returned.
  show() {
    // The background is already active.
    if (this.actor.reactive) { return true; }

    // Something went wrong. Let's abort this.
    if (!Main.pushModal(this.actor)) { return false; }

    // Make the actor visible and clickable.
    this.actor.reactive = true;
    this.actor.visible  = true;

    // Add the fade-in animation.
    Tweener.removeTweens(this.actor);
    Tweener.addTween(this.actor, {time : 0.3, transition : 'ease', opacity : 255});

    return true;
  }

  // This hides the background again. The input will not be grabbed anymore.
  hide() {
    // The actor is not active. Nothing to be done.
    if (!this.actor.reactive) { return; }

    // Un-grab the input.
    Main.popModal(this.actor);

    // Do not receive input events anymore.
    this.actor.reactive = false;

    // Add the fade-out animation.
    Tweener.removeTweens(this.actor);
    Tweener.addTween(this.actor, {
      time : 0.5,
      transition : 'ease',
      opacity : 0,
      onComplete : () => this.actor.visible = false
    });
  }
};
