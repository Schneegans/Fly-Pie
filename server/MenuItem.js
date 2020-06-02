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
  GRANDCHILD: 3,
};

// clang-format off
var MenuItem = GObject.registerClass({
  Properties: {
    'state': GObject.ParamSpec.int(
        'state', 'state', 'The state the MenuItem is currently in.',
        GObject.ParamFlags.READWRITE, 0, 3, 0),
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

    this._iconColor = utils.getIconColor(Gio.Icon.new_for_string(this.icon));

    this._centerIcon = new St.Icon(
        {gicon: Gio.Icon.new_for_string(this.icon), fallback_icon_name: 'image-missing'});

    this._centerIcon.set_easing_duration(300);
    this._childIcon = new St.Icon(
        {gicon: Gio.Icon.new_for_string(this.icon), fallback_icon_name: 'image-missing'});

    this._childIcon.set_easing_duration(300);

    this._centerIcon.icon_size = this.width / 2;
    this._childIcon.icon_size  = this.width / 2;

    this._centerIcon.set_translation(-this.width / 4, -this.height / 4, 0);
    this._childIcon.set_translation(-this.width / 4, -this.height / 4, 0);

    this._centerBackground = new Clutter.Actor(
        {height: this.height, width: this.width, reactive: false, opacity: 255});
    this._centerBackground.set_easing_duration(300);
    this._centerBackground.add_effect(
        new Clutter.ColorizeEffect({tint: this._iconColor}));

    this._childBackground = new Clutter.Actor(
        {height: this.height, width: this.width, reactive: false, opacity: 255});
    this._childBackground.set_easing_duration(300);
    this._childBackground.add_effect(new Clutter.ColorizeEffect({tint: this._iconColor}));

    this._grandchildBackground = new Clutter.Actor(
        {height: this.height, width: this.width, reactive: false, opacity: 255});
    this._grandchildBackground.set_easing_duration(300);
    this._grandchildBackground.add_effect(
        new Clutter.ColorizeEffect({tint: this._iconColor}));


    this.add_child(this._centerBackground);
    this.add_child(this._childBackground);
    this.add_child(this._grandchildBackground);

    this._centerBackground.set_translation(-this.width / 2, -this.height / 2, 0);
    this._childBackground.set_translation(-this.width / 2, -this.height / 2, 0);
    this._grandchildBackground.set_translation(-this.width / 2, -this.height / 2, 0);

    this._centerBackground.set_content(this.center_canvas);
    this._childBackground.set_content(this.child_canvas);
    this._grandchildBackground.set_content(this.grandchild_canvas);

    this.add_child(this._centerIcon);
    this.add_child(this._childIcon);

    this.connect('notify::state', this._onStateChange.bind(this));
    this._onStateChange();
  }

  _onStateChange() {
    this._centerIcon.opacity           = 0;
    this._childIcon.opacity            = 0;
    this._centerBackground.opacity     = 0;
    this._childBackground.opacity      = 0;
    this._grandchildBackground.opacity = 0;

    if (this.state == MenuItemState.ACTIVE) {
      this._centerIcon.opacity       = 255;
      this._centerBackground.opacity = 255;
    } else if (this.state == MenuItemState.CHILD) {
      this._childIcon.opacity       = 255;
      this._childBackground.opacity = 255;
    } else if (this.state == MenuItemState.GRANDCHILD) {
      this._grandchildBackground.opacity = 255;
    }
  }
});
