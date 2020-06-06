//////////////////////////////////////////////////////////////////////////////////////////
//                                                                                      //
//    _____                    ___  _     ___       This software may be modified       //
//   / ___/__  ___  __ _  ___ / _ \(_)__ |_  |      and distributed under the           //
//  / (_ / _ \/ _ \/  ' \/ -_) ___/ / -_) __/       terms of the MIT license. See       //
//  \___/_//_/\___/_/_/_/\__/_/  /_/\__/____/       the LICENSE file for details.       //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Cairo                   = imports.cairo;
const {Clutter, Gio, GObject} = imports.gi;

const Me    = imports.misc.extensionUtils.getCurrentExtension();
const utils = Me.imports.common.utils;

//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////

// clang-format off
var Wedges = GObject.registerClass({
},
class Wedges extends Clutter.Actor {
  // clang-format on

  // ------------------------------------------------------------ constructor / destructor

  _init(params = {}) {
    super._init(params);

    this._separatorAngles = [];
    this._activeWedge     = -1;

    this._canvas = new Clutter.Canvas();

    this._canvas.connect('draw', (canvas, ctx, width, height) => {
      ctx.setOperator(Cairo.Operator.CLEAR);
      ctx.paint();
      ctx.setOperator(Cairo.Operator.OVER);
      ctx.translate(width / 2, width / 2);

      let wedgeColor = this._createRadialGradient(this._settings.wedgeColor, width / 2);
      let activeWedgeColor =
          this._createRadialGradient(this._settings.activeWedgeColor, width / 2);

      ctx.save();

      for (let i = 0; i < this._separatorAngles.length; i++) {
        let angle     = this._separatorAngles[i];
        let nextAngle = this._separatorAngles[(i + 1) % this._separatorAngles.length];

        if (nextAngle < angle) {
          nextAngle += 360;
        }

        if (i == this._activeWedge) {
          ctx.setSource(activeWedgeColor);
        } else {
          ctx.setSource(wedgeColor);
        }

        ctx.moveTo(0, 0);
        ctx.arc(
            0, 0, width / 2, (angle - 90) / 180 * Math.PI,
            (nextAngle - 90) / 180 * Math.PI);
        ctx.fill();
      }

      ctx.restore();

      let wedgeSeparatorColor =
          this._createRadialGradient(this._settings.wedgeSeparatorColor, width / 2);

      this._separatorAngles.forEach(angle => {
        ctx.save();
        ctx.rotate((angle - 90) / 180 * Math.PI);
        ctx.moveTo(0, 0);
        ctx.lineTo(width / 2, 0);

        ctx.restore();
      });

      ctx.setSource(wedgeSeparatorColor);

      ctx.setLineWidth(1);
      ctx.stroke();
    });

    this.set_content(this._canvas);
  }

  // -------------------------------------------------------------------- public interface

  onSettingsChange(settings) {
    // Parse all settings required for wedge rendering.
    let globalScale = settings.get_double('global-scale');

    // clang-format off
    this._settings = {
      animationDuration:     settings.get_double('animation-duration')  * 1000,
      wedgeSize:             settings.get_double('wedge-size')          * globalScale,
      wedgeColor:            utils.stringToRGBA(settings.get_string('wedge-color')),
      activeWedgeColor:      utils.stringToRGBA(settings.get_string('active-wedge-color')),
      wedgeSeparatorColor:   utils.stringToRGBA(settings.get_string('wedge-separator-color')),
    };
    // clang-format on

    this.set_size(this._settings.wedgeSize, this._settings.wedgeSize);
    this.set_translation(-this._settings.wedgeSize / 2, -this._settings.wedgeSize / 2, 0);
    this._canvas.set_size(this._settings.wedgeSize, this._settings.wedgeSize);

    this._canvas.invalidate();
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
    this._canvas.invalidate();
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

    if (distance > 50) {
      for (let i = 0; i < this._separatorAngles.length; i++) {
        let startAngle = this._separatorAngles[i];
        let endAngle   = this._separatorAngles[(i + 1) % this._separatorAngles.length];

        if (endAngle < startAngle) {
          endAngle += 360;
        }

        if (angle > startAngle && angle <= endAngle ||
            angle + 360 > startAngle && angle + 360 <= endAngle) {
          newActiveWedge = i;
          break
        }
      }
    }

    if (newActiveWedge != this._activeWedge) {
      this._activeWedge = newActiveWedge;
      this._canvas.invalidate();
    }
  }


  // ----------------------------------------------------------------------- private stuff

  _createRadialGradient(color, radius) {
    let gradient = new Cairo.RadialGradient(0, 0, 0, 0, 0, radius);
    gradient.addColorStopRGBA(0, color.red, color.green, color.blue, color.alpha);
    gradient.addColorStopRGBA(1, color.red, color.green, color.blue, 0);
    return gradient;
  }
});