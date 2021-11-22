//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Cairo                    = imports.cairo;
const {Clutter, GObject, GLib} = imports.gi;

const Me    = imports.misc.extensionUtils.getCurrentExtension();
const utils = Me.imports.src.common.utils;

//////////////////////////////////////////////////////////////////////////////////////////
// This is a Clutter.Actor which draws an additional mouse pointer at your mouse. This  //
// may sound a bit weird but has a very specific use-case - if you want to capture a    //
// video of Fly-Pie, you may encounter two issues:                                      //
//  - People watching your video will not see when you pressed the buttons of your      //
//    mouse. This is however quite important to understand the behavior of Fly-Pie.     //
//  - When using the built-in screen-recorder of GNOME Shell, a hard-coded frame-rate   //
//    of 10 FPS is used to capture the mouse. Even if the rest of the video consists    //
//    of smooth 60 FPS footage, the video will look very sloppy as the mouse moves      //
//    sluggishly around.                                                                //
// As a solution for these problems, I created this little class. Just enable it in     //
// Fly-Pie's settings and make sure that your screen recorder does not capture your     //
// normal mouse!                                                                        //
//////////////////////////////////////////////////////////////////////////////////////////

// clang-format off
var MouseHighlight = GObject.registerClass({
  Properties: {},
  Signals: {}
},
class MouseHighlight extends Clutter.Actor {
  // clang-format on

  // ------------------------------------------------------------ constructor / destructor

  // The size in pixels is given to the constructor.
  _init(size) {
    super._init();

    // This stores the currently pressed modifiers.
    this._mods = 0;

    // The pointer is drawn to this canvas.
    this._canvas = new Clutter.Canvas();
    this._canvas.connect('draw', (canvas, ctx, width, height) => {
      ctx.setOperator(Cairo.Operator.CLEAR);
      ctx.paint();
      ctx.setOperator(Cairo.Operator.OVER);

      const lineWidth  = 2;
      const cursorSize = size - 2 * lineWidth;

      // The pointer is made of four points like this:
      //   A
      //   | \
      //   |   \
      //   |     \
      //   |       \
      //   |   C -- D
      //   | /
      //   B

      const ax = 0.0 * cursorSize + lineWidth;
      const ay = 0.0 * cursorSize + lineWidth;

      const bx = 0.0 * cursorSize + lineWidth;
      const by = 1.0 * cursorSize + lineWidth;

      const cx = 0.29 * cursorSize + lineWidth;
      const cy = 0.707 * cursorSize + lineWidth;

      const dx = 0.707 * cursorSize + lineWidth;
      const dy = 0.707 * cursorSize + lineWidth;

      // First draw the left-click area.
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.lineTo(cx, cy);
      ctx.lineTo(ax, ay);

      if (this._mods & Clutter.ModifierType.BUTTON1_MASK) {
        ctx.setSourceRGB(0.5, 1.0, 0.5);
      } else {
        ctx.setSourceRGB(0, 0, 0);
      }
      ctx.fill();

      // Then draw the right-click area.
      ctx.moveTo(ax, ay);
      ctx.lineTo(cx, cy);
      ctx.lineTo(dx, dy);
      ctx.lineTo(ax, ay);

      // The right mouse button is BUTTON2 on Wayland and BUTTON3 on X11...
      if (this._mods & Clutter.ModifierType.BUTTON2_MASK ||
          this._mods & Clutter.ModifierType.BUTTON3_MASK) {
        ctx.setSourceRGB(1.0, 0.5, 0.5);
      } else {
        ctx.setSourceRGB(0.2, 0.2, 0.2);
      }
      ctx.fill();

      // Finally draw the line around the entire cursor.
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.lineTo(cx, cy);
      ctx.lineTo(dx, dy);
      ctx.lineTo(ax, ay);

      ctx.setSourceRGB(1, 1, 1);
      ctx.setLineWidth(lineWidth);
      ctx.stroke();

      // Explicitly tell Cairo to free the context memory. Is this really necessary?
      ctx.$dispose();
    });

    this._canvas.set_size(size, size);
    this._canvas.invalidate();

    // Set the size of the anchor. For some reason a small offset is required to make it
    // exactly match the original mouse pointer's position.
    this.set_size(size, size);
    this.set_translation(-3, -3, 0);
    this.set_content(this._canvas);

    // Update the position of the pointer at 100 Hz.
    this._updateTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 10, () => {
      const [x, y, mods] = global.get_pointer();
      this.set_position(x, y);

      if (this._mods != mods) {
        this._mods = mods;
        this._canvas.invalidate();
      }

      return true;
    });
  }

  // Do not attempt to update the cursor when it's deleted.
  destroy() {
    GLib.source_remove(this._updateTimeout);
  }
});