//////////////////////////////////////////////////////////////////////////////////////////
//                                                                                      //
//    _____                    ___  _     ___       This software may be modified       //
//   / ___/__  ___  __ _  ___ / _ \(_)__ |_  |      and distributed under the           //
//  / (_ / _ \/ _ \/  ' \/ -_) ___/ / -_) __/       terms of the MIT license. See       //
//  \___/_//_/\___/_/_/_/\__/_/  /_/\__/____/       the LICENSE file for details.       //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Cairo   = imports.cairo;
const Clutter = imports.gi.Clutter;
const Gio     = imports.gi.Gio;
const GObject = imports.gi.GObject;
const St      = imports.gi.St;

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = ExtensionUtils.getCurrentExtension();
const debug          = Me.imports.common.debug.debug;
const Theme          = Me.imports.server.Theme.Theme;

//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////

// clang-format off
var MenuItem = GObject.registerClass({
  Properties: {
    'icon': GObject.ParamSpec.object(
        'icon', 'icon', 'The gio icon to be used by this menu item.',
        GObject.ParamFlags.READWRITE, Gio.Icon.$gtype),
    'theme': GObject.ParamSpec.object(
        'theme', 'theme', 'The theme to be used by this menu item.',
        GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT_ONLY, Theme.$gtype)
  }
},
class MenuItem extends Clutter.Actor {
  // clang-format on

  _init(params = {}) {
    this._icon = new St.Icon({fallback_icon_name: 'image-missing'});

    super._init(params);

    this._icon.icon_size = super.width / 2;
    this._icon.set_translation(-super.width / 4, -super.height / 4, 0);


    this._background =
        new Clutter.Actor({height: super.height, width: super.width, reactive: false});
    super.add_child(this._background);

    this._background.set_translation(-super.width / 2, -super.height / 2, 0);

    let canvas = new Clutter.Canvas({height: super.height, width: super.width});

    // let color = Clutter.Color.new(this.theme.menuColor);

    canvas.connect('draw', (canvas, ctx, width, height) => {
      ctx.setOperator(Cairo.Operator.CLEAR);
      ctx.paint();
      ctx.setOperator(Cairo.Operator.OVER);
      ctx.scale(width, height);
      ctx.translate(0.5, 0.5);
      ctx.arc(0, 0, 0.5, 0, 2.0 * Math.PI);
      // ctx.setSourceRGBA(
      //     color.red / 255.0, color.green / 255.0, color.blue / 255.0,
      //     color.alpha / 255.0);
      ctx.fill();
    });

    this._background.set_content(canvas);
    canvas.invalidate();

    super.add_child(this._icon);
  }

  get icon() {
    return this._icon.get_gicon();
  }

  set icon(value) {
    if (this._icon.gicon !== value) {
      this._icon.set_gicon(value);
      this.notify('icon');
    }
  }
});