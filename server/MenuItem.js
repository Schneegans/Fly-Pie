//////////////////////////////////////////////////////////////////////////////////////////
//                                                                                      //
//    _____                    ___  _     ___       This software may be modified       //
//   / ___/__  ___  __ _  ___ / _ \(_)__ |_  |      and distributed under the           //
//  / (_ / _ \/ _ \/  ' \/ -_) ___/ / -_) __/       terms of the MIT license. See       //
//  \___/_//_/\___/_/_/_/\__/_/  /_/\__/____/       the LICENSE file for details.       //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const {Clutter, Gio, GObject, St} = imports.gi;

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
        'Can be an "icon-name", an ":emoji:" or a path like "file://../icon.png".',
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



    this._centerBackground = new Clutter.Actor();
    this._centerBackground.set_easing_duration(300);
    this._centerBackground.add_effect(new Clutter.ColorizeEffect());

    this._childBackground = new Clutter.Actor();
    this._childBackground.set_easing_duration(300);
    this._childBackground.add_effect(new Clutter.ColorizeEffect());

    this._grandchildBackground = new Clutter.Actor();
    this._grandchildBackground.set_easing_duration(300);
    this._grandchildBackground.add_effect(new Clutter.ColorizeEffect());

    this.add_child(this._centerBackground);
    this.add_child(this._childBackground);
    this.add_child(this._grandchildBackground);


    this._centerBackground.set_content(this.center_canvas);
    this._childBackground.set_content(this.child_canvas);
    this._grandchildBackground.set_content(this.grandchild_canvas);

    this.connect('notify::state', this._onStateChange.bind(this));
    this._onStateChange();
  }

  _onStateChange() {
    if (this._centerIcon) {
      this._centerIcon.opacity = 0;
      this._centerIcon.visible = false;
    }

    if (this._childIcon) {
      this._childIcon.opacity = 0;
      this._childIcon.visible = false;
    }

    this._centerBackground.opacity     = 0;
    this._childBackground.opacity      = 0;
    this._grandchildBackground.opacity = 0;

    if (this.state == MenuItemState.ACTIVE) {
      if (!this._centerIcon) {
        this._centerIcon = new St.Icon({
          gicon: Gio.Icon.new_for_string(this.icon),
          fallback_icon_name: 'image-missing',
        });
        this._centerIcon.set_easing_duration(300);
        this.add_child(this._centerIcon);
      }

      this._centerIcon.opacity       = 255;
      this._centerBackground.opacity = 255;
      this._centerIcon.icon_size     = 50;
      this._centerIcon.visible       = true;
      this._centerIcon.set_position(-50 / 2, -50 / 2);
      this.set_position(0, 0);

    } else if (this.state == MenuItemState.CHILD) {
      if (!this._childIcon) {
        this._childIcon = new St.Icon({
          gicon: Gio.Icon.new_for_string(this.icon),
        });
        this._childIcon.set_easing_duration(300);
        this.add_child(this._childIcon);
      }

      this._childIcon.opacity       = 255;
      this._childBackground.opacity = 255;
      this._childIcon.icon_size     = 25;
      this._childIcon.visible       = true;
      this._childIcon.set_position(-25 / 2, -25 / 2);
      this.set_position(Math.sin(this.angle) * 100, -Math.cos(this.angle) * 100);

    } else if (this.state == MenuItemState.GRANDCHILD) {
      this._grandchildBackground.opacity = 255;
      this.set_position(Math.sin(this.angle) * 25, -Math.cos(this.angle) * 25);
    }

    if (this.state == MenuItemState.ACTIVE || this.state == MenuItemState.CHILD) {
      if (!this._iconColor) {
        this._iconColor = utils.getIconColor(Gio.Icon.new_for_string(this.icon));
      }

      this._centerBackground.get_effects()[0].tint     = this._iconColor;
      this._childBackground.get_effects()[0].tint      = this._iconColor;
      this._grandchildBackground.get_effects()[0].tint = this._iconColor;
    }

    if (this.state == MenuItemState.HIDDEN) {
      this.visible = false;
    } else {
      this.visible = true;

      this._centerBackground.set_position(-100 / 2, -100 / 2);
      this._centerBackground.set_size(100, 100);
      this._childBackground.set_position(-50 / 2, -50 / 2);
      this._childBackground.set_size(50, 50);
      this._grandchildBackground.set_position(-10 / 2, -10 / 2);
      this._grandchildBackground.set_size(10, 10);
    }
  }
});
