//////////////////////////////////////////////////////////////////////////////////////////
//                                                                                      //
//    _____                    ___  _     ___       This software may be modified       //
//   / ___/__  ___  __ _  ___ / _ \(_)__ |_  |      and distributed under the           //
//  / (_ / _ \/ _ \/  ' \/ -_) ___/ / -_) __/       terms of the MIT license. See       //
//  \___/_//_/\___/_/_/_/\__/_/  /_/\__/____/       the LICENSE file for details.       //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Gdk = imports.gi.Gdk

const Clutter        = imports.gi.Clutter;
const Cairo          = imports.cairo;
const St             = imports.gi.St;
const ExtensionUtils = imports.misc.extensionUtils;
const Main           = imports.ui.main;

const Me = ExtensionUtils.getCurrentExtension();

const debug            = Me.imports.common.debug.debug;
const utils            = Me.imports.server.utils;
const InputManipulator = Me.imports.server.InputManipulator.InputManipulator;
const DBusInterface    = Me.imports.common.DBusInterface.DBusInterface;

var Menu = class Menu {

  // ------------------------------------------------------------ constructor / destructor

  constructor(onHover, onSelect, onCancel) {
    this._loadTheme();

    this._onHover  = onHover;
    this._onSelect = onSelect;
    this._onCancel = onCancel;

    this._input = new InputManipulator();

    this._background = new Clutter.Actor({
      height: Main.layoutManager.currentMonitor.height,
      width: Main.layoutManager.currentMonitor.width,
      backgroundColor: this._theme.backgroundColor,
      reactive: false,
      visible: false,
      opacity: 0
    });

    this._background.set_easing_duration(300);
    this._background.connect('transitions-completed', () => {
      if (this._background.opacity == 0) {
        this._background.visible = false;
      }
    });

    this._menuRoot = new Clutter.Actor({height: 100, width: 100, reactive: false});

    this._menuRoot.set_position(-this._menuRoot.width / 2, -this._menuRoot.height / 2);
    this._menuRoot.set_pivot_point(0.5, 0.5);

    this._background.add_child(this._menuRoot);

    let canvas = new Clutter.Canvas({height: 100, width: 100});
    canvas.connect('draw', (canvas, ctx, width, height) => {
      ctx.setOperator(Cairo.Operator.CLEAR);
      ctx.paint();
      ctx.setOperator(Cairo.Operator.OVER);
      ctx.scale(width, height);
      ctx.translate(0.5, 0.5);
      ctx.arc(0, 0, 0.5, 0, 2.0 * Math.PI);
      ctx.setSourceRGBA(
          this._theme.foregroundColor.red / 255.0,
          this._theme.foregroundColor.green / 255.0,
          this._theme.foregroundColor.blue / 255.0,
          this._theme.foregroundColor.alpha / 255.0);
      ctx.fill();
    });

    this._menuRoot.set_content(canvas);
    canvas.invalidate();

    Main.uiGroup.add_actor(this._background);

    this._background.connect('button-release-event', (actor, event) => {
      if (event.get_button() == 1) {
        let currentTime = global.get_current_time() * 0.001;
        let scale       = Math.sin(currentTime) * 4.5 + 5.0;

        this._menuRoot.set_easing_duration(300);
        this._menuRoot.set_scale(scale, scale);
        this._menuRoot.set_easing_duration(0);
      } else {
        this._hide();
        this._onCancel(this._menuID);
      }
    });

    this._background.connect('motion-event', (actor, event) => {
      let [x, y] = event.get_coords();
      this._menuRoot.set_translation(x, y, 0);
    });

    // For some reason this has to be set explicitly to true before it can be set to
    // false.
    global.stage.cursor_visible = true;
  }

  destroy() {
    Main.uiGroup.removeactor(this._background);
    this._background = null;
  }

  // -------------------------------------------------------------------- public interface

  // This shows the menu, blocking all user input. A subtle animation is used to fade in
  // the menu. Returns false if the menu failed to grab the input. It will not be shown
  // in this case, if everything worked as supposed, true will be returned.
  show(menuID, menu) {
    // Store the ID.
    this._menuID = menuID;

    // The background is already active.
    if (this._background.reactive) {
      return DBusInterface.errorCodes.eAlreadyActive;
    }

    // Something went wrong. Let's abort this.
    if (!Main.pushModal(this._background)) {
      return DBusInterface.errorCodes.eUnknownError;
    }

    // Make the actor visible and clickable.
    this._background.reactive = true;
    this._background.visible  = true;

    // Add the fade-in animation.
    this._background.opacity = 255;

    // Calculate window position.
    let [pointerX, pointerY] = global.get_pointer();
    let [posX, posY]         = this._clampToToMonitor(
        pointerX, pointerY, this._menuRoot.width, this._menuRoot.height,
        this._theme.monitorPadding);
    this._menuRoot.set_translation(posX, posY, 0);

    return this._menuID;
  }

  // ----------------------------------------------------------------------- private stuff

  _hide() {
    // The actor is not active. Nothing to be done.
    if (!this._background.reactive) {
      return;
    }

    // Un-grab the input.
    Main.popModal(this._background);

    // Do not receive input events anymore.
    this._background.reactive = false;

    // Add the fade-out animation.
    this._background.opacity = 0;
  }

  _loadTheme() {
    this._theme = {};

    this._theme.globalScale    = 1;
    this._theme.monitorPadding = 8;
    this._theme.backgroundColor =
        new Clutter.Color({red: 0, green: 0, blue: 0, alpha: 50});
    this._theme.foregroundColor =
        new Clutter.Color({red: 200, green: 200, blue: 200, alpha: 255});
  }

  // (x, y) is the center of the box to be clamped,
  // return value is a new position (x, y)
  _clampToToMonitor(x, y, width, height, margin) {
    let monitor = Main.layoutManager.currentMonitor;

    let minX = margin + width / 2;
    let minY = margin + height / 2;

    let maxX = monitor.width - margin - width / 2;
    let maxY = monitor.height - margin - height / 2;

    let posX = Math.min(Math.max(x, minX), maxX);
    let posY = Math.min(Math.max(y, minY), maxY);

    return [Math.floor(posX), Math.floor(posY)];
  }
};
