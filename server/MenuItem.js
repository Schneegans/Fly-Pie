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
  },
  Signals: {}
},
class MenuItem extends Clutter.Actor {
  // clang-format on

  _init(params = {}) {
    super._init(params);

    this._oldCenterIconSize = 0;
    this._oldChildIconSize  = 0;

    // Create Background Actors.
    this._background                     = new Clutter.Actor();
    this._background.minification_filter = Clutter.ScalingFilter.TRILINEAR;
    this._background.add_effect(new Clutter.ColorizeEffect());
    this._background.set_content(this.background_canvas);

    this.add_child(this._background);

    // Create Children Container.
    this._childrenContainer = new Clutter.Actor();
    this.add_child(this._childrenContainer);

    this.connect('notify::state', this._onStateChange.bind(this));
  }

  getChildrenContainer() {
    return this._childrenContainer;
  }

  onSettingsChange(settings) {

    // First reset some members to force re-creation during the next state change.

    if (this._centerIcon) {
      // We store the icon size so that we can create the new one at the same size later.
      // This allows for smooth icon size transitions in edit mode.
      this._oldCenterIconSize = this._centerIcon.width;
      this._centerIcon.destroy();
      delete this._centerIcon;
    }

    if (this._childIcon) {
      // We store the icon size so that we can create the new one at the same size later.
      // This allows for smooth icon size transitions in edit mode.
      this._oldChildIconSize = this._childIcon.width;
      this._childIcon.destroy();
      delete this._childIcon;
    }

    // Then parse all settings required during state change.
    let globalScale = settings.get_double('global-scale');

    // clang-format off
    this._settings = {
      animationDuration:             settings.get_double('animation-duration')      * 1000,
      textColor:                     utils.stringToRGBA(settings.get_string('text-color')),
      font:                          settings.get_string('font'),
      centerColorMode:               settings.get_string('center-color-mode'),
      centerColor:                   Clutter.Color.from_string(settings.get_string('center-fixed-color'))[1],
      centerSize:                    settings.get_double('center-size')             * globalScale,
      centerIconScale:               settings.get_double('center-icon-scale'),
      centerAutoColorSaturation:     settings.get_double('center-auto-color-saturation'),
      centerAutoColorLuminance:      settings.get_double('center-auto-color-luminance'),
      centerAutoColorAlpha:          settings.get_double('center-auto-color-alpha')      * 255,
      childColorMode:                settings.get_string('child-color-mode'),
      childFixedColor:               Clutter.Color.from_string(settings.get_string('child-fixed-color'))[1],
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
      childAutoColorAlpha:           settings.get_double('child-auto-color-alpha')       * 255,
      childAutoColorAlphaHover:      settings.get_double('child-auto-color-alpha-hover') * 255,
      childDrawAbove:                settings.get_boolean('child-draw-above'),
      grandchildColorMode:           settings.get_string('grandchild-color-mode'),
      grandchildFixedColor:          Clutter.Color.from_string(settings.get_string('grandchild-fixed-color'))[1],
      grandchildSize:                settings.get_double('grandchild-size')         * globalScale,
      grandchildSizeHover:           settings.get_double('grandchild-size-hover')   * globalScale,
      grandchildOffset:              settings.get_double('grandchild-offset')       * globalScale,
      grandchildOffsetHover:         settings.get_double('grandchild-offset-hover') * globalScale,
      grandchildDrawAbove:           settings.get_boolean('grandchild-draw-above'),
    };
    // clang-format on

    // Some settings we can apply here.
    this._background.set_easing_duration(this._settings.animationDuration);
    this.set_easing_duration(this._settings.animationDuration);

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

      if (this._settings.childDrawAbove) {
        this.set_child_above_sibling(this._childrenContainer, null);
      } else {
        this.set_child_below_sibling(this._childrenContainer, null);
      }

      let size     = this._settings.centerSize;
      let iconSize = size * this._settings.centerIconScale;

      if (!this._centerIcon) {
        this._centerIcon = this._createIcon(iconSize);
        setSizeAndOpacity(this._centerIcon, this._oldCenterIconSize, 255);
        this._centerIcon.set_easing_duration(this._settings.animationDuration);
        this.add_child(this._centerIcon);

        if (this._settings.centerColorMode == 'auto') {
          this._centerAutoColor = utils.getAverageIconColor(
              utils.getIcon(this.icon, 24), 24, this._settings.centerAutoColorSaturation,
              this._settings.centerAutoColorLuminance,
              this._settings.centerAutoColorAlpha);
        }
      }

      if (this._settings.centerColorMode == 'auto') {
        this._background.get_effects()[0].tint = this._centerAutoColor;
      } else {
        this._background.get_effects()[0].tint = this._settings.centerColor;
      }

      setSizeAndOpacity(this._centerIcon, iconSize, 255);
      setSizeAndOpacity(
          this._background, size, this._background.get_effects()[0].tint.alpha);

      if (this._childIcon) {
        setSizeAndOpacity(this._childIcon, iconSize, 0);
      }



    } else if (this.state == MenuItemState.CHILD) {

      if (this._settings.grandchildDrawAbove) {
        this.set_child_above_sibling(this._childrenContainer, null);
      } else {
        this.set_child_below_sibling(this._childrenContainer, null);
      }

      let size     = this._settings.childSize;
      let iconSize = size * this._settings.childIconScale;

      if (!this._childIcon) {
        this._childIcon = this._createIcon(iconSize);
        setSizeAndOpacity(this._childIcon, this._oldChildIconSize, 255);
        this._childIcon.set_easing_duration(this._settings.animationDuration);
        this.add_child(this._childIcon);

        if (this._settings.childColorMode == 'auto') {
          this._childAutoColor = utils.getAverageIconColor(
              utils.getIcon(this.icon, 24), 24, this._settings.childAutoColorSaturation,
              this._settings.childAutoColorLuminance, this._settings.childAutoColorAlpha);
        }
      }

      if (this._settings.childColorMode == 'auto') {
        this._background.get_effects()[0].tint = this._childAutoColor;
      } else {
        this._background.get_effects()[0].tint = this._settings.childFixedColor;
      }

      setSizeAndOpacity(this._childIcon, iconSize, 255);
      setSizeAndOpacity(
          this._background, size, this._background.get_effects()[0].tint.alpha);

      if (this._centerIcon) {
        setSizeAndOpacity(this._centerIcon, iconSize, 0);
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

      this._background.get_effects()[0].tint = this._settings.grandchildFixedColor;

      setSizeAndOpacity(
          this._background, size, this._background.get_effects()[0].tint.alpha);


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
