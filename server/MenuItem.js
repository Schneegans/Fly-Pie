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
  INVISIBLE: 0,
  ACTIVE: 1,
  CHILD: 2,
  HOVERED_CHILD: 3,
  GRANDCHILD: 4,
  HOVERED_GRANDCHILD: 5,
};

// clang-format off
var MenuItem = GObject.registerClass({
  Properties: {
    'state': GObject.ParamSpec.int(
        'state', 'state', 'The state the MenuItem is currently in.',
        GObject.ParamFlags.READWRITE, 0, 5, MenuItemState.INVISIBLE),
    'angle': GObject.ParamSpec.double(
        'angle', 'angle', 'The angle of the MenuItem.',
        GObject.ParamFlags.READWRITE, 0, 2 * Math.PI, 0),
    'icon': GObject.ParamSpec.string(
        'icon', 'icon',
        'The icon to be used by this menu item. ' +
        'Can be an "icon-name", an ":emoji:" or a path like "../icon.png".',
        GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT_ONLY, 'image-missing'),
    'background-canvas': GObject.ParamSpec.object(
        'background-canvas', 'background-canvas',
        'The Clutter.Content to be used by this menu as background.',
        GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT_ONLY, Clutter.Content.$gtype),
  }
},
class MenuItem extends Clutter.Actor {
  // clang-format on

  _init(params = {}) {
    super._init(params);

    // Create Background Actors.
    this._background                     = new Clutter.Actor();
    this._background.minification_filter = Clutter.ScalingFilter.TRILINEAR;
    this._background.add_effect(new Clutter.ColorizeEffect());
    this._background.set_content(this.background_canvas);

    this.add_child(this._background);

    this.connect('notify::state', this._onStateChange.bind(this));
  }

  setSettings(settings) {

    // First reset some members to force re-creation during the next state change.
    if (this._centerIcon) {
      this._centerIcon.destroy();
      delete this._centerIcon;
    }

    if (this._childIcon) {
      this._childIcon.destroy();
      delete this._childIcon;
    }

    // Then parse all settings required during state change.
    let globalScale = settings.get_double('global-scale');

    // clang-format off
    this._settings = {
      animationDuration:             settings.get_double('animation-duration'),
      textColor:                     utils.stringToRGBA(settings.get_string('text-color')),
      font:                          settings.get_string('font'),
      centerColorMode:               settings.get_string('center-color-mode'),
      centerColor:                   Clutter.Color.from_string(settings.get_string('center-color'))[1],
      centerSize:                    settings.get_double('center-size')             * globalScale,
      centerIconScale:               settings.get_double('center-icon-scale'),
      centerAutoColorSaturation:     settings.get_double('center-auto-color-saturation'),
      centerAutoColorLuminance:      settings.get_double('center-auto-color-luminance'),
      childColorMode:                settings.get_string('child-color-mode'),
      childColor:                    Clutter.Color.from_string(settings.get_string('child-color'))[1],
      childSize:                     settings.get_double('child-size')              * globalScale,
      childSizeHover:                settings.get_double('child-size-hover')        * globalScale,
      childOffset:                   settings.get_double('child-offset')            * globalScale,
      childOffsetHover:              settings.get_double('child-offset-hover')      * globalScale,
      childIconScale:                settings.get_double('child-icon-scale'),
      childIconScaleHover:           settings.get_double('child-icon-scale-hover'),
      childAutoColorSaturation:      settings.get_double('child-auto-color-saturation'),
      childAutoColorSaturationHover: settings.get_double('child-auto-color-saturation-hover'),
      childAutoColorLuminance:       settings.get_double('child-auto-color-luminance'),
      childAutoColorLuminanceHover:  settings.get_double('child-auto-color-luminance-hover'),
      grandchildColorMode:           settings.get_string('grandchild-color-mode'),
      grandchildColor:               Clutter.Color.from_string(settings.get_string('grandchild-color'))[1],
      grandchildSize:                settings.get_double('grandchild-size')         * globalScale,
      grandchildSizeHover:           settings.get_double('grandchild-size-hover')   * globalScale,
      grandchildOffset:              settings.get_double('grandchild-offset')       * globalScale,
      grandchildOffsetHover:         settings.get_double('grandchild-offset-hover') * globalScale,
    };
    // clang-format on

    this._background.set_easing_duration(this._settings.animationDuration);

    // Then execute a full state change.
    this._onStateChange();
  }

  _onStateChange() {

    let setSizeAndOpacity = (actor, size, opacity) => {
      let size2     = Math.floor(size / 2);
      actor.opacity = opacity;
      actor.set_size(size, size);
      actor.set_position(-size2, -size2);
    };

    if (this.state == MenuItemState.ACTIVE) {

      let size     = this._settings.centerSize;
      let iconSize = size * this._settings.centerIconScale;

      if (!this._centerIcon) {
        this._centerIcon = this._createIcon(iconSize);
        this._centerIcon.set_easing_duration(this._settings.animationDuration);
        this.add_child(this._centerIcon);

        if (this._settings.centerColorMode == 'auto') {
          this._centerIconColor = utils.getAverageIconColor(
              utils.getIcon(this.icon, 24), 24, this._settings.centerAutoColorSaturation,
              this._settings.centerAutoColorLuminance);
        }
      }

      setSizeAndOpacity(this._centerIcon, iconSize, 255);
      setSizeAndOpacity(this._background, size, 255);

      if (this._childIcon) {
        setSizeAndOpacity(this._childIcon, iconSize, 0);
      }

      if (this._settings.centerColorMode == 'auto') {
        this._background.get_effects()[0].tint = this._centerIconColor;
      } else {
        this._background.get_effects()[0].tint = this._settings.centerColor;
      }

    } else if (this.state == MenuItemState.CHILD) {

      let size     = this._settings.childSize;
      let iconSize = size * this._settings.childIconScale;

      if (!this._childIcon) {
        this._childIcon = this._createIcon(iconSize);
        this._childIcon.set_easing_duration(this._settings.animationDuration);
        this.add_child(this._childIcon);

        if (this._settings.childColorMode == 'auto') {
          this._childIconColor = utils.getAverageIconColor(
              utils.getIcon(this.icon, 24), 24, this._settings.childAutoColorSaturation,
              this._settings.childAutoColorLuminance);
        }
      }

      setSizeAndOpacity(this._childIcon, iconSize, 255);
      setSizeAndOpacity(this._background, size, 255);

      if (this._centerIcon) {
        setSizeAndOpacity(this._centerIcon, iconSize, 0);
      }

      if (this._settings.childColorMode == 'auto') {
        this._background.get_effects()[0].tint = this._childIconColor;
      } else {
        this._background.get_effects()[0].tint = this._settings.childColor;
      }

      this.set_position(
          Math.floor(Math.sin(this.angle) * this._settings.childOffset),
          -Math.floor(Math.cos(this.angle) * this._settings.childOffset));

    } else if (this.state == MenuItemState.GRANDCHILD) {

      let size     = this._settings.grandchildSize;
      let iconSize = size * this._settings.childIconScale;

      if (this._centerIcon) {
        setSizeAndOpacity(this._centerIcon, iconSize, 0);
      }

      if (this._childIcon) {
        setSizeAndOpacity(this._childIcon, iconSize, 0);
      }

      setSizeAndOpacity(this._background, size, 255);

      this._background.get_effects()[0].tint = this._settings.grandchildColor;

      this.set_position(
          Math.floor(Math.sin(this.angle) * this._settings.grandchildOffset),
          -Math.floor(Math.cos(this.angle) * this._settings.grandchildOffset));
    }

    this.visible = this.state != MenuItemState.INVISIBLE;
  }

  // Create Icon Actor.
  _createIcon(size) {
    let canvas = new Clutter.Canvas({height: size, width: size});
    canvas.connect('draw', (c, ctx, width, height) => {
      ctx.setOperator(Cairo.Operator.CLEAR);
      ctx.paint();
      ctx.setOperator(Cairo.Operator.OVER);

      let icon = utils.getIcon(this.icon, size);
      ctx.setSourceSurface(icon, 0, 0);
      ctx.paint();
    });

    canvas.invalidate();

    let actor = new Clutter.Actor();
    actor.set_content(canvas);

    return actor;
  }
});
