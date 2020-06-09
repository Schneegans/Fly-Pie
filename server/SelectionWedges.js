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

    this._wedgeActor  = new Clutter.Actor();
    this._wedgeShader = new Clutter.ShaderEffect({
      shader_type: Clutter.ShaderType.FRAGMENT_SHADER,
    });

    this._wedgeShader.set_shader_source(`
      uniform float r;
      uniform float g;
      uniform float b;
      uniform float a;

      uniform float rHover;
      uniform float gHover;
      uniform float bHover;
      uniform float aHover;

      uniform float innerRadius;
      uniform float startAngle;
      uniform float endAngle;

      void main(void) {
        vec2 pos    = 2.0 * (cogl_tex_coord_in[0].xy - vec2(0.5));
        float alpha = a;
        vec3 color  = vec3(r, g, b);

        float distance = sqrt(pos.x * pos.x + pos.y * pos.y);
        float angle    = 0;
        if (distance > innerRadius) {
          angle = acos(pos.x / distance) * 180 / 3.141592653589793;
          if (pos.y < 0) {
            angle = 360 - angle;
          }
          
          angle = mod((angle + 90), 360);
          if (angle > startAngle && angle <= endAngle ||
              angle + 360 > startAngle && angle + 360 <= endAngle) {

            color = vec3(rHover, gHover, bHover);
            alpha = aHover;
          }
        }

        float distFac  = 1.0 - clamp((length(pos) - innerRadius) / (1.0-innerRadius), 0.0, 1.0);
        alpha *= distFac * cogl_color_in.a;

        cogl_color_out.rgb = color * alpha;
        cogl_color_out.a = alpha;
      }
    `);

    this._wedgeActor.add_effect(this._wedgeShader);
    this.add_child(this._wedgeActor);

    this._separatorCanvas = new Clutter.Canvas();
    this._separatorCanvas.connect('draw', (canvas, ctx, width, height) => {
      ctx.setOperator(Cairo.Operator.CLEAR);
      ctx.paint();
      ctx.setOperator(Cairo.Operator.OVER);

      let gradient =
          new Cairo.LinearGradient(this._settings.wedgeInnerRadius, 0, width, 0);
      let color = this._settings.wedgeSeparatorColor;
      gradient.addColorStopRGBA(0, color.red, color.green, color.blue, color.alpha);
      gradient.addColorStopRGBA(1, color.red, color.green, color.blue, 0);

      ctx.setLineWidth(this._settings.wedgeSeparatorWidth);
      ctx.setLineCap(Cairo.LineCap.ROUND);
      ctx.moveTo(this._settings.wedgeInnerRadius, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.setSource(gradient);
      ctx.stroke();
    });

    this._separators = new Clutter.Actor();
    this.add_child(this._separators);


    // this._canvas.connect('draw', (canvas, ctx, width, height) => {
    //   ctx.setOperator(Cairo.Operator.CLEAR);
    //   ctx.paint();
    //   ctx.setOperator(Cairo.Operator.OVER);
    //   ctx.translate(width / 2, width / 2);

    //   let wedgeColor = this._createRadialGradient(
    //       this._settings.wedgeColor, this._settings.wedgeInnerRadius, width / 2);
    //   let wedgeColorHover = this._createRadialGradient(
    //       this._settings.wedgeColorHover, this._settings.wedgeInnerRadius, width /
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
    //       ctx.setSource(wedgeColorHover);
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
      wedgeColorHover:       utils.stringToRGBA(settings.get_string('wedge-color-hover')),
      wedgeSeparatorColor:   utils.stringToRGBA(settings.get_string('wedge-separator-color')),
      wedgeSeparatorWidth:   settings.get_double('wedge-separator-width') * globalScale,
    };
    // clang-format on

    this.set_easing_duration(this._settings.animationDuration);

    let outerRadius = this._settings.wedgeInnerRadius + this._settings.wedgeWidth;
    this._wedgeActor.set_size(outerRadius * 2, outerRadius * 2);
    this._wedgeActor.set_translation(-outerRadius, -outerRadius, 0);

    this._separatorCanvas.set_size(
        this._settings.wedgeInnerRadius + this._settings.wedgeWidth,
        this._settings.wedgeSeparatorWidth + 10);
    this._separatorCanvas.invalidate();

    this._separators.get_children().forEach(child => {
      child.set_size(
          this._settings.wedgeInnerRadius + this._settings.wedgeWidth,
          this._settings.wedgeSeparatorWidth + 10);
      child.translation_y = -child.height / 2;
    });

    this._setUniform('innerRadius', this._settings.wedgeInnerRadius / outerRadius);

    this._setUniform('r', this._settings.wedgeColor.red);
    this._setUniform('g', this._settings.wedgeColor.green);
    this._setUniform('b', this._settings.wedgeColor.blue);
    this._setUniform('a', this._settings.wedgeColor.alpha);

    this._setUniform('rHover', this._settings.wedgeColorHover.red);
    this._setUniform('gHover', this._settings.wedgeColorHover.green);
    this._setUniform('bHover', this._settings.wedgeColorHover.blue);
    this._setUniform('aHover', this._settings.wedgeColorHover.alpha);
  }

  setItemAngles(itemAngles) {
    this._separatorAngles = [];

    this._separators.destroy_all_children();

    if (itemAngles.length >= 2) {
      for (let i = 0; i < itemAngles.length; i++) {
        let angle     = itemAngles[i];
        let nextAngle = itemAngles[(i + 1) % itemAngles.length];

        if (nextAngle < angle) {
          nextAngle += 360;
        }

        let separatorAngle = (angle + nextAngle) / 2;
        this._separatorAngles.push(separatorAngle);

        let separator = new Clutter.Actor({
          width: this._settings.wedgeInnerRadius + this._settings.wedgeWidth,
          height: this._settings.wedgeSeparatorWidth + 10
        });

        separator.rotation_angle_z = separatorAngle - 90;
        // separator.translation_x    = -separator.width / 2;
        separator.translation_y = -separator.height / 2;
        separator.set_pivot_point(0, 0.5);
        separator.set_content(this._separatorCanvas);
        this._separators.add_child(separator);
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

    let activeWedge           = -1;
    let activeWedgeStartAngle = 0;
    let activeWedgeEndAngle   = 0;

    if (distance > this._settings.wedgeInnerRadius) {
      for (let i = 0; i < this._separatorAngles.length; i++) {
        let startAngle = this._separatorAngles[i];
        let endAngle   = this._separatorAngles[(i + 1) % this._separatorAngles.length];

        if (endAngle < startAngle) {
          endAngle += 360;
        }

        if (angle > startAngle && angle <= endAngle ||
            angle + 360 > startAngle && angle + 360 <= endAngle) {
          activeWedge           = i;
          activeWedgeStartAngle = startAngle;
          activeWedgeEndAngle   = endAngle;
          break
        }
      }
    }

    if (activeWedge != this._activeWedge) {
      this._setUniform('startAngle', activeWedgeStartAngle);
      this._setUniform('endAngle', activeWedgeEndAngle);
      this._activeWedge = activeWedge;
    }
  }


  // ----------------------------------------------------------------------- private stuff

  _setUniform(name, value) {
    if (Number.isInteger(value)) {
      value += 0.0000001;
    }
    this._wedgeShader.set_uniform_value(name, value);
  }
});