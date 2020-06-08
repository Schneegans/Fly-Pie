//////////////////////////////////////////////////////////////////////////////////////////
//                                                                                      //
//    _____                    ___  _     ___       This software may be modified       //
//   / ___/__  ___  __ _  ___ / _ \(_)__ |_  |      and distributed under the           //
//  / (_ / _ \/ _ \/  ' \/ -_) ___/ / -_) __/       terms of the MIT license. See       //
//  \___/_//_/\___/_/_/_/\__/_/  /_/\__/____/       the LICENSE file for details.       //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Cairo                         = imports.cairo;
const {Clutter, Cogl, Gio, GObject} = imports.gi;

const Me    = imports.misc.extensionUtils.getCurrentExtension();
const utils = Me.imports.common.utils;

//////////////////////////////////////////////////////////////////////////////////////////
// I actually wanted to override vfunc_paint(paintContext) but I did not manage to create
// a shader program.
//  * Deprecated Cogl.create_*() methods return undefined...?
//  * New CoglSnippet API of Cogl 2.0+ is not yet available as it seems.
//////////////////////////////////////////////////////////////////////////////////////////

// clang-format off
var SelectionWedges = GObject.registerClass({
  Properties: {},
  Signals: {}
},
class SelectionWedges extends Clutter.Actor {
  // clang-format on

  // ------------------------------------------------------------ constructor / destructor

  _init(params = {}) {
    super._init(params);

    this._separatorAngles = [];
    this._activeWedge     = -1;

    this._shader = new Clutter.ShaderEffect({
      shader_type: Clutter.ShaderType.FRAGMENT_SHADER,
    });

    this._shader.set_shader_source(`
      uniform float r;
      uniform float g;
      uniform float b;
      uniform float a;

      uniform float rHover;
      uniform float gHover;
      uniform float bHover;
      uniform float aHover;

      uniform float startAngle;
      uniform float endAngle;

      void main(void) {
        vec2 pos    = 2.0 * (cogl_tex_coord_in[0].xy - vec2(0.5));
        float alpha = a;
        vec3 color  = vec3(r, g, b);

        float distance = sqrt(pos.x * pos.x + pos.y * pos.y);
        float angle    = 0;
        if (distance > 0) {
          angle = acos(pos.x / distance) * 180 / 3.141592653589793;
          if (pos.y < 0) {
            angle = 360 - angle;
          }
        }

        angle = mod((angle + 90), 360);
        if (angle > startAngle && angle <= endAngle ||
            angle + 360 > startAngle && angle + 360 <= endAngle) {
          color = vec3(rHover, gHover, bHover);
          alpha = aHover;
        }

        float distFac  = 1.0 - min(1.0, length(pos));
        alpha *= distFac * cogl_color_in.a;

        cogl_color_out.rgb = color * alpha;
        cogl_color_out.a = alpha;
      }
    `);

    this.add_effect(this._shader);

    // utils.debug(' ' + this._program.get_target());

    // this._canvas.connect('draw', (canvas, ctx, width, height) => {
    //   ctx.setOperator(Cairo.Operator.CLEAR);
    //   ctx.paint();
    //   ctx.setOperator(Cairo.Operator.OVER);
    //   ctx.translate(width / 2, width / 2);

    //   let wedgeColor = this._createRadialGradient(
    //       this._settings.wedgeColor, this._settings.wedgeInnerRadius, width / 2);
    //   let activeWedgeColor = this._createRadialGradient(
    //       this._settings.activeWedgeColor, this._settings.wedgeInnerRadius, width /
    //       2);

    //   ctx.save();

    //   for (let i = 0; i < this._separatorAngles.length; i++) {
    //     let angle     = this._separatorAngles[i];
    //     let nextAngle = this._separatorAngles[(i + 1) %
    //     this._separatorAngles.length];

    //     if (nextAngle < angle) {
    //       nextAngle += 360;
    //     }

    //     if (i == this._activeWedge) {
    //       ctx.setSource(activeWedgeColor);
    //     } else {
    //       ctx.setSource(wedgeColor);
    //     }

    //     let a = (angle - 90) / 180 * Math.PI;
    //     let b = (nextAngle - 90) / 180 * Math.PI;

    //     ctx.moveTo(0, 0);
    //     ctx.arc(0, 0, width / 2, a, b);
    //     ctx.fill();
    //   }

    //   ctx.restore();

    //   let wedgeSeparatorColor =
    //       this._createRadialGradient(this._settings.wedgeSeparatorColor, 0, width /
    //       2);

    //   this._separatorAngles.forEach(angle => {
    //     ctx.save();
    //     ctx.rotate((angle - 90) / 180 * Math.PI);
    //     ctx.moveTo(this._settings.wedgeInnerRadius, 0);
    //     ctx.lineTo(width / 2, 0);

    //     ctx.restore();
    //   });

    //   ctx.setSource(wedgeSeparatorColor);

    //   ctx.setLineWidth(1);
    //   ctx.stroke();
    // });

    // this.set_content(this._canvas);
  }

  // -------------------------------------------------------------------- public interface

  onSettingsChange(settings) {
    // Parse all settings required for wedge rendering.
    let globalScale = settings.get_double('global-scale');

    // clang-format off
    this._settings = {
      animationDuration:     settings.get_double('animation-duration')   * 1000,
      wedgeWidth:            settings.get_double('wedge-width')          * globalScale,
      wedgeInnerRadius:      settings.get_double('wedge-inner-radius')   * globalScale,
      wedgeColor:            utils.stringToRGBA(settings.get_string('wedge-color')),
      activeWedgeColor:      utils.stringToRGBA(settings.get_string('active-wedge-color')),
      wedgeSeparatorColor:   utils.stringToRGBA(settings.get_string('wedge-separator-color')),
    };
    // clang-format on

    this.set_easing_duration(this._settings.animationDuration);

    let radius = this._settings.wedgeInnerRadius + this._settings.wedgeWidth;
    this.set_size(radius * 2, radius * 2);
    this.set_translation(-radius, -radius, 0);

    this._shader.set_uniform_value('r', this._settings.wedgeColor.red + 0.0000001);
    this._shader.set_uniform_value('g', this._settings.wedgeColor.green + 0.0000001);
    this._shader.set_uniform_value('b', this._settings.wedgeColor.blue + 0.0000001);
    this._shader.set_uniform_value('a', this._settings.wedgeColor.alpha + 0.0000001);

    this._shader.set_uniform_value(
        'rHover', this._settings.activeWedgeColor.red + 0.0000001);
    this._shader.set_uniform_value(
        'gHover', this._settings.activeWedgeColor.green + 0.0000001);
    this._shader.set_uniform_value(
        'bHover', this._settings.activeWedgeColor.blue + 0.0000001);
    this._shader.set_uniform_value(
        'aHover', this._settings.activeWedgeColor.alpha + 0.0000001);
  }

  setItemAngles(itemAngles) {
    this._separatorAngles = [];

    if (itemAngles.length >= 2) {
      for (let i = 0; i < itemAngles.length; i++) {
        let angle     = itemAngles[i];
        let nextAngle = itemAngles[(i + 1) % itemAngles.length];

        if (nextAngle < angle) {
          nextAngle += 360;
        }

        this._separatorAngles.push((angle + nextAngle) / 2);
      }
    }
  }

  setPointerPosition(x, y) {
    let distance = Math.sqrt(x * x + y * y);
    let angle    = 0;
    if (distance > 0) {
      angle = Math.acos(x / distance) * 180 / Math.PI;
      if (y < 0) {
        angle = 360 - angle;
      }
    }

    angle = (angle + 90) % 360;

    let newActiveWedge = -1;

    this._shader.set_uniform_value('startAngle', 0 + 0.0000001);
    this._shader.set_uniform_value('endAngle', 0 + 0.0000001);

    if (distance > this._settings.wedgeInnerRadius) {
      for (let i = 0; i < this._separatorAngles.length; i++) {
        let startAngle = this._separatorAngles[i];
        let endAngle   = this._separatorAngles[(i + 1) % this._separatorAngles.length];

        if (endAngle < startAngle) {
          endAngle += 360;
        }

        if (angle > startAngle && angle <= endAngle ||
            angle + 360 > startAngle && angle + 360 <= endAngle) {
          newActiveWedge = i;

          this._shader.set_uniform_value('startAngle', startAngle + 0.0000001);
          this._shader.set_uniform_value('endAngle', endAngle + 0.0000001);
          break
        }
      }
    }

    if (newActiveWedge != this._activeWedge) {
      this._activeWedge = newActiveWedge;
    }
  }


  // ----------------------------------------------------------------------- private stuff
});