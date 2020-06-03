//////////////////////////////////////////////////////////////////////////////////////////
//                                                                                      //
//    _____                    ___  _     ___       This software may be modified       //
//   / ___/__  ___  __ _  ___ / _ \(_)__ |_  |      and distributed under the           //
//  / (_ / _ \/ _ \/  ' \/ -_) ___/ / -_) __/       terms of the MIT license. See       //
//  \___/_//_/\___/_/_/_/\__/_/  /_/\__/____/       the LICENSE file for details.       //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Cairo                             = imports.cairo;
const {Gdk, Gtk, Clutter, Gio, GObject} = imports.gi;

const Me    = imports.misc.extensionUtils.getCurrentExtension();
const utils = Me.imports.common.utils;

//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////

// This could be a static member of the class below, but this seems to be not supported
// yet.
var MenuItemState = {
  HIDDEN: 0,
  ACTIVE: 1,
  CHILD: 2,
  HOVERED_CHILD: 3,
  GRANDCHILD: 4,
  PARENT: 5,
};

// clang-format off
var MenuItem = GObject.registerClass({
  Properties: {
    'state': GObject.ParamSpec.int(
        'state', 'state', 'The state the MenuItem is currently in.',
        GObject.ParamFlags.READWRITE, 0, 5, MenuItemState.HIDDEN),
    'angle': GObject.ParamSpec.double(
        'angle', 'angle', 'The angle of the MenuItem.',
        GObject.ParamFlags.READWRITE, 0, 2 * Math.PI, 0),
    'icon': GObject.ParamSpec.string(
        'icon', 'icon',
        'The icon to be used by this menu item. ' +
        'Can be an "icon-name", an ":emoji:" or a path like "../icon.png".',
        GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT_ONLY, 'image-missing'),
    'center-canvas': GObject.ParamSpec.object(
        'center-canvas', 'center-canvas',
        'The Clutter.Content to be used by this menu item when shown as center element.',
        GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT_ONLY, Clutter.Content.$gtype),
    'child-canvas': GObject.ParamSpec.object(
        'child-canvas', 'child-canvas',
        'The Clutter.Content to be used by this menu item when shown as child element.',
        GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT_ONLY, Clutter.Content.$gtype),
    'grandchild-canvas': GObject.ParamSpec.object(
        'grandchild-canvas', 'grandchild-canvas',
        'The Clutter.Content to be used by this menu item when shown as grandchild element.',
        GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT_ONLY, Clutter.Content.$gtype)
  }
},
class MenuItem extends Clutter.Actor {
  // clang-format on

  _init(params = {}) {
    super._init(params);

    // Create Background Actors.
    this._centerBackgroundActor = new Clutter.Actor();
    this._centerBackgroundActor.add_effect(new Clutter.ColorizeEffect());
    this._centerBackgroundActor.set_content(this.center_canvas);

    this._childBackgroundActor = new Clutter.Actor();
    this._childBackgroundActor.add_effect(new Clutter.ColorizeEffect());
    this._childBackgroundActor.set_content(this.child_canvas);

    this._grandchildBackgroundActor = new Clutter.Actor();
    this._grandchildBackgroundActor.add_effect(new Clutter.ColorizeEffect());
    this._grandchildBackgroundActor.set_content(this.grandchild_canvas);

    this.add_child(this._centerBackgroundActor);
    this.add_child(this._childBackgroundActor);
    this.add_child(this._grandchildBackgroundActor);

    this.connect('notify::state', this._onStateChange.bind(this));
  }

  setSettings(settings) {
    this._centerBackgroundActor.set_easing_duration(300);
    this._childBackgroundActor.set_easing_duration(300);
    this._grandchildBackgroundActor.set_easing_duration(300);

    this._onStateChange();
  }

  _onStateChange() {
    if (this._iconActor) {
      this._iconActor.opacity = 0;
      this._iconActor.visible = false;
    }

    this._centerBackgroundActor.opacity     = 0;
    this._childBackgroundActor.opacity      = 0;
    this._grandchildBackgroundActor.opacity = 0;

    if (this.state == MenuItemState.ACTIVE) {
      if (!this._iconActor) {
        this._createIcon();
      }

      this._iconActor.opacity = 255;
      this._iconActor.set_size(50, 50);
      this._iconActor.set_position(-50 / 2, -50 / 2);
      this._centerBackgroundActor.opacity = 255;
      this.set_position(0, 0);

    } else if (this.state == MenuItemState.CHILD) {
      if (!this._iconActor) {
        this._createIcon();
      }

      this._childBackgroundActor.opacity = 255;
      this._iconActor.opacity            = 255;
      this._iconActor.set_size(32, 32);
      this._iconActor.set_position(-32 / 2, -32 / 2);
      this.set_position(
          Math.floor(Math.sin(this.angle) * 100),
          -Math.floor(Math.cos(this.angle) * 100));

    } else if (this.state == MenuItemState.GRANDCHILD) {
      this._grandchildBackgroundActor.opacity = 255;
      this.set_position(
          Math.floor(Math.sin(this.angle) * 25), -Math.floor(Math.cos(this.angle) * 25));
    }

    if (this.state == MenuItemState.ACTIVE || this.state == MenuItemState.CHILD) {
      if (!this._iconColor) {
        let iconSurface = utils.getIcon(this.icon, 24);
        this._iconColor = utils.getAverageIconColor(iconSurface, 24, 0.0, 0.5);
      }

      this._centerBackgroundActor.get_effects()[0].tint     = this._iconColor;
      this._childBackgroundActor.get_effects()[0].tint      = this._iconColor;
      this._grandchildBackgroundActor.get_effects()[0].tint = this._iconColor;
    }

    if (this.state == MenuItemState.HIDDEN) {
      this.visible = false;
    } else {
      this.visible = true;

      this._centerBackgroundActor.set_position(-100 / 2, -100 / 2);
      this._centerBackgroundActor.set_size(100, 100);
      this._childBackgroundActor.set_position(-50 / 2, -50 / 2);
      this._childBackgroundActor.set_size(50, 50);
      this._grandchildBackgroundActor.set_position(-10 / 2, -10 / 2);
      this._grandchildBackgroundActor.set_size(10, 10);
    }
  }

  _createIcon() {
    // Create Icon Actor.
    this._iconCanvas = new Clutter.Canvas({height: 32, width: 32});
    this._iconCanvas.connect('draw', (canvas, ctx, width, height) => {
      ctx.setOperator(Cairo.Operator.CLEAR);
      ctx.paint();
      ctx.setOperator(Cairo.Operator.OVER);

      let iconSurface = utils.getIcon(this.icon, Math.min(width, height));
      ctx.setSourceSurface(iconSurface, 0, 0);
      ctx.paint();
    });

    this._iconCanvas.invalidate();

    this._iconActor = new Clutter.Actor();
    this._iconActor.set_content(this._iconCanvas);
    this._iconActor.set_easing_duration(300);
    this._iconActor.minification_filter = Clutter.ScalingFilter.TRILINEAR;

    this.add_child(this._iconActor);
  }
});
