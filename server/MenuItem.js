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
  ACTIVE_HOVER: 2,
  CHILD: 3,
  CHILD_HOVER: 4,
  GRANDCHILD: 5,
  GRANDCHILD_HOVER: 6,
};

// clang-format off
var MenuItem = GObject.registerClass({
  Properties: {
    'state': GObject.ParamSpec.int(
        'state', 'state', 'The state the MenuItem is currently in.',
        GObject.ParamFlags.READWRITE, 0, 6, MenuItemState.INVISIBLE),
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

    this._lastIconSize = 0;

    // Create Background Actors.
    this._background                     = new Clutter.Actor();
    this._background.minification_filter = Clutter.ScalingFilter.TRILINEAR;
    this._background.add_effect(new Clutter.ColorizeEffect());
    this._background.set_content(this.background_canvas);

    this.add_child(this._background);

    // Create Children Container.
    this._childrenContainer = new Clutter.Actor();
    this.add_child(this._childrenContainer);

    this._handlers = {
      state: this.connect('notify::state', () => this._onStateChange()),
      destroy: this.connect(
          'destroy',
          () => {
            this.disconnect(this._handlers['state']);
            this.disconnect(this._handlers['destroy']);
          }),
    };
  }

  getChildrenContainer() {
    return this._childrenContainer;
  }

  onSettingsChange(settings) {

    // First reset some members to force re-creation during the next state change.
    const resetIcon = (propertyName) => {
      if (this[propertyName]) {
        this[propertyName].destroy();
        delete this[propertyName];
      }
    };

    resetIcon('_centerIcon');
    resetIcon('_centerIconHover');
    resetIcon('_childIcon');
    resetIcon('_childIconHover');

    // Then parse all settings required during state change.
    const globalScale = settings.get_double('global-scale');

    // clang-format off
    this._settings = {
      animationDuration:       settings.get_double('animation-duration')      * 1000,
      textColor:               utils.stringToRGBA(settings.get_string('text-color')),
      font:                    settings.get_string('font'),
      state: new Map ([
        [MenuItemState.ACTIVE, {
          colorMode:           settings.get_string('center-color-mode'),
          fixedColor:          Clutter.Color.from_string(settings.get_string('center-fixed-color'))[1],
          size:                settings.get_double('center-size')  * globalScale,
          offset:              0,
          iconProperty:        '_centerIcon',
          iconSize:            settings.get_double('center-size')  * globalScale *
                               settings.get_double('center-icon-scale'),
          autoColorSaturation: settings.get_double('center-auto-color-saturation'),
          autoColorLuminance:  settings.get_double('center-auto-color-luminance'),
          autoColorAlpha:      settings.get_double('center-auto-color-alpha') * 255,
          drawChildrenAbove:   settings.get_boolean('child-draw-above'),
        }],
        [MenuItemState.ACTIVE_HOVER, {
          colorMode:           settings.get_string('center-color-mode-hover'),
          fixedColor:          Clutter.Color.from_string(settings.get_string('center-fixed-color-hover'))[1],
          size:                settings.get_double('center-size-hover')  * globalScale,
          offset:              0,
          iconProperty:        '_centerIconHover',
          iconSize:            settings.get_double('center-size-hover')  * globalScale * 
                               settings.get_double('center-icon-scale-hover'),
          autoColorSaturation: settings.get_double('center-auto-color-saturation-hover'),
          autoColorLuminance:  settings.get_double('center-auto-color-luminance-hover'),
          autoColorAlpha:      settings.get_double('center-auto-color-alpha-hover') * 255,
          drawChildrenAbove:   settings.get_boolean('child-draw-above'),
        }],
        [MenuItemState.CHILD, {
          colorMode:           settings.get_string('child-color-mode'),
          fixedColor:          Clutter.Color.from_string(settings.get_string('child-fixed-color'))[1],
          size:                settings.get_double('child-size')     * globalScale,
          offset:              settings.get_double('child-offset')   * globalScale,
          iconProperty:        '_childIcon',
          iconSize:            settings.get_double('child-size')     * globalScale * 
                               settings.get_double('child-icon-scale'),
          autoColorSaturation: settings.get_double('child-auto-color-saturation'),
          autoColorLuminance:  settings.get_double('child-auto-color-luminance'),
          autoColorAlpha:      settings.get_double('child-auto-color-alpha')  * 255,
          drawChildrenAbove:   settings.get_boolean('grandchild-draw-above'),
        }],
        [MenuItemState.CHILD_HOVER, {
          colorMode:           settings.get_string('child-color-mode-hover'),
          fixedColor:          Clutter.Color.from_string(settings.get_string('child-fixed-color-hover'))[1],
          size:                settings.get_double('child-size-hover')    * globalScale,
          offset:              settings.get_double('child-offset-hover')  * globalScale,
          iconProperty:        '_childIconHover',
          iconSize:            settings.get_double('child-size-hover')    * globalScale * 
                               settings.get_double('child-icon-scale-hover'),
          autoColorSaturation: settings.get_double('child-auto-color-saturation-hover'),
          autoColorLuminance:  settings.get_double('child-auto-color-luminance-hover'),
          autoColorAlpha:      settings.get_double('child-auto-color-alpha-hover') * 255,
          drawChildrenAbove:   settings.get_boolean('grandchild-draw-above'),
        }],
        [MenuItemState.GRANDCHILD, {
          colorMode:           settings.get_string('grandchild-color-mode'),
          fixedColor:          Clutter.Color.from_string(settings.get_string('grandchild-fixed-color'))[1],
          size:                settings.get_double('grandchild-size')    * globalScale,
          offset:              settings.get_double('grandchild-offset')  * globalScale,
          iconProperty:        '',
          iconSize:            settings.get_double('child-size')         * globalScale *
                               settings.get_double('child-icon-scale'),
          drawAbove:           settings.get_boolean('grandchild-draw-above'),
        }],
        [MenuItemState.GRANDCHILD_HOVER, {
          colorMode:           settings.get_string('grandchild-color-mode-hover'),
          fixedColor:          Clutter.Color.from_string(settings.get_string('grandchild-fixed-color-hover'))[1],
          size:                settings.get_double('grandchild-size-hover')   * globalScale,
          offset:              settings.get_double('grandchild-offset-hover') * globalScale,
          iconProperty:        '',
          iconSize:            settings.get_double('child-size-hover') * globalScale * settings.get_double('child-icon-scale-hover'),
          drawAbove:           settings.get_boolean('grandchild-draw-above'),
        }]
      ]),
    };
    // clang-format on

    // Some settings we can apply here.
    this._background.set_easing_duration(this._settings.animationDuration);
    this.set_easing_duration(this._settings.animationDuration);

    // Then execute a full state change.
    this._onStateChange();
  }

  _onStateChange() {

    this.visible = this.state != MenuItemState.INVISIBLE;

    if (this.state == MenuItemState.INVISIBLE) {
      return;
    }

    const state = this._settings.state.get(this.state);

    if (state.drawChildrenAbove) {
      this.set_child_above_sibling(this._childrenContainer, null);
    } else {
      this.set_child_below_sibling(this._childrenContainer, null);
    }

    if (this.state != MenuItemState.ACTIVE && this.state != MenuItemState.ACTIVE_HOVER) {
      this.set_translation(
          Math.floor(Math.sin(this.angle) * state.offset),
          -Math.floor(Math.cos(this.angle) * state.offset), 0);
    }

    if (state.iconProperty != '' && !this[state.iconProperty]) {
      this[state.iconProperty] = this._createIcon(state.iconSize);

      this._setSizeAndOpacity(
          state.iconProperty,
          this._lastIconSize > 0 ? this._lastIconSize : state.iconSize, 255);
      this[state.iconProperty].set_easing_duration(this._settings.animationDuration);
      this.add_child(this[state.iconProperty]);

      if (state.colorMode == 'auto') {
        const icon = new Cairo.ImageSurface(Cairo.Format.ARGB32, 24, 24);
        const ctx  = new Cairo.Context(icon);
        utils.paintIcon(ctx, this.icon, 24);
        this[state.iconProperty + 'Color'] = utils.getAverageIconColor(
            icon, 24, state.autoColorSaturation, state.autoColorLuminance,
            state.autoColorAlpha);
        ctx.$dispose();
      }
    }

    if (state.colorMode == 'auto') {
      this._background.get_effects()[0].tint = this[state.iconProperty + 'Color'];
      // this._background.get_effects()[0].tint = state.fixedColor;
    } else {
      this._background.get_effects()[0].tint = state.fixedColor;
    }

    this._setSizeAndOpacity(
        '_centerIcon', state.iconSize, state.iconProperty == '_centerIcon' ? 255 : 0);
    this._setSizeAndOpacity(
        '_centerIconHover', state.iconSize,
        state.iconProperty == '_centerIconHover' ? 255 : 0);
    this._setSizeAndOpacity(
        '_childIcon', state.iconSize, state.iconProperty == '_childIcon' ? 255 : 0);
    this._setSizeAndOpacity(
        '_childIconHover', state.iconSize,
        state.iconProperty == '_childIconHover' ? 255 : 0);
    this._setSizeAndOpacity(
        '_background', state.size, this._background.get_effects()[0].tint.alpha);

    this._lastIconSize = state.iconSize;
  }

  // Create Icon Actor.
  _createIcon(size) {
    const canvas = new Clutter.Canvas({height: size, width: size});
    canvas.connect('draw', (c, ctx, width, height) => {
      ctx.setOperator(Cairo.Operator.CLEAR);
      ctx.paint();
      ctx.setOperator(Cairo.Operator.OVER);
      utils.paintIcon(ctx, this.icon, width);

      // Explicitly tell Cairo to free the context memory. Is this really necessary?
      // https://wiki.gnome.org/Projects/GnomeShell/Extensions/TipsOnMemoryManagement#Cairo
      ctx.$dispose();
    });

    canvas.invalidate();

    const actor = new Clutter.Actor();
    actor.set_content(canvas);

    return actor;
  }

  _setSizeAndOpacity(actorName, size, opacity) {
    const actor = this[actorName];
    if (actor) {
      const size2   = Math.floor(size / 2);
      actor.opacity = opacity;
      actor.set_size(size, size);
      actor.set_translation(-size2, -size2, 0);
    }
  }
});
