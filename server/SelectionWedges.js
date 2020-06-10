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
// This class is instantiated once by the Menu and is responsible for drawing the       //
// wedges behind the currently active menu. The wedge beneath the mouse pointer is      //
// highlighted.                                                                         //
// Originally I tried to implement this with a huge Clutter.Canvas, but this turned out //
// to be much to slow. Then I tried to override vfunc_paint(paintContext) of the actor, //
// but I failed to create a shader program in GJS.                                      //
//  * There are some deprecated Cogl.create_*() methods but they return undefined.      //
//  * The new CoglSnippet API of Cogl 2.0+ is not yet available as it seems.            //
// I still believe that this approach would be better than the Clutter.ShaderEffect I   //
// am using now. As a Clutter.OffscreenEffect, the Clutter.ShaderEffect allocates an    //
// offscreen framebuffer for rendering which is not required in our case. So if there   //
// are performance issues, this is definitely something to look at!                     //
//                                                                                      //
// In the current implementation one large square-shaped actor with a                   //
// Clutter.ShaderEffect is responsible for drawing the wedge-fill gradients, including  //
// the currently highlighted one. Then there are multiple smaller elongated actors,     //
// one for each separator line. They all share one Clutter.Canvas which contains a      //
// simple gradient line drawn with Cairo.                                               //
//////////////////////////////////////////////////////////////////////////////////////////

// clang-format off
var SelectionWedges = GObject.registerClass({
  Properties: {},
  Signals: {
    "hovered-wedge-change-event":{
      param_types: [GObject.TYPE_INT],
    },
  }
},
class SelectionWedges extends Clutter.Actor {
  // clang-format on

  // ------------------------------------------------------------ constructor / destructor

  _init(params = {}) {
    super._init(params);

    // This will contain the angles at which separator lines should be drawn. In degree,
    // clockwise, O° at the top.
    this._separatorAngles = [];

    // This is the index of the currently hovered wedge.
    this._hoveredWedge = -1;

    // This is attached as a child to *this* and is responsible for drawing the
    // wedge-gradient. This is done with a Clutter.ShaderEffect as this is much faster
    // than a Clutter.Canvas.
    this._wedgeActor  = new Clutter.Actor();
    this._wedgeShader = new Clutter.ShaderEffect({
      shader_type: Clutter.ShaderType.FRAGMENT_SHADER,
    });

    // This shader could be simplified by using vec4's for the colors, but I did not
    // manage to call Clutter.ShaderEffect.set_uniform_value() accordingly from GJS. If
    // anybody knows how this is accomplished, feel free to send a pull request :-)
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

        // We first assume the normal color for all fragments.
        cogl_color_out = vec4(r, g, b, a);
        
        // Then we use the hover color for fragments outside the innerRadius and
        // between startAngle and endAngle.
        vec2  pos      = 2.0 * (cogl_tex_coord_in[0].xy - vec2(0.5));
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

            cogl_color_out = vec4(rHover, gHover, bHover, aHover);
          }
        }

        // Fade-out the color towards the outer radius.
        float distFac     = 1.0 - clamp((length(pos) - innerRadius) / (1.0-innerRadius), 0.0, 1.0);
        cogl_color_out.a *= distFac;

        // Inherit the opacity of parent actors.
        cogl_color_out.a *= cogl_color_in.a;
        
        // We use premultiplied alpha.
        cogl_color_out.rgb *= cogl_color_out.a;
      }
    `);

    this._wedgeActor.add_effect(this._wedgeShader);
    this.add_child(this._wedgeActor);

    // Now we create the Clutter.Canvas which will be used by the separator actors. It
    // just contains a simple line with a gradient.
    this._separatorCanvas = new Clutter.Canvas();
    this._separatorCanvas.connect('draw', (canvas, ctx, width, height) => {
      ctx.setOperator(Cairo.Operator.CLEAR);
      ctx.paint();
      ctx.setOperator(Cairo.Operator.OVER);

      const gradient =
          new Cairo.LinearGradient(this._settings.wedgeInnerRadius, 0, width, 0);
      const color = this._settings.wedgeSeparatorColor;
      gradient.addColorStopRGBA(0, color.red, color.green, color.blue, color.alpha);
      gradient.addColorStopRGBA(1, color.red, color.green, color.blue, 0);

      ctx.setLineWidth(this._settings.wedgeSeparatorWidth);
      ctx.setLineCap(Cairo.LineCap.ROUND);
      ctx.moveTo(this._settings.wedgeInnerRadius, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.setSource(gradient);
      ctx.stroke();

      // Explicitly tell Cairo to free the context memory. Is this really necessary?
      ctx.$dispose();
    });

    // This actor acts as a group for all separators so that we can easily iterate over
    // them and destroy them once we're done.
    this._separators = new Clutter.Actor();
    this.add_child(this._separators);
  }

  // -------------------------------------------------------------------- public interface

  // This is called once in the beginning and then whenever the user changes something in
  // the settings.
  onSettingsChange(settings) {

    // Parse all settings required for wedge rendering.
    const globalScale = settings.get_double('global-scale');

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

    // Color values are not transitioned at all, but we use this for the position of the
    // wedges.
    this.set_easing_duration(this._settings.animationDuration);

    // Update the size and position of the wedge actor.
    const outerRadius = this._settings.wedgeInnerRadius + this._settings.wedgeWidth;
    this._wedgeActor.set_size(outerRadius * 2, outerRadius * 2);
    this._wedgeActor.set_translation(-outerRadius, -outerRadius, 0);

    // Update and re-draw the separator canvas.
    this._separatorCanvas.set_size(
        this._settings.wedgeInnerRadius + this._settings.wedgeWidth,
        this._settings.wedgeSeparatorWidth + 5);
    this._separatorCanvas.invalidate();

    // Update the size and position of all separator actors.
    this._separators.get_children().forEach(child => {
      child.set_size(
          this._settings.wedgeInnerRadius + this._settings.wedgeWidth,
          this._settings.wedgeSeparatorWidth + 5);
      child.translation_y = -child.height / 2;
    });

    // This could be shortened if we could set vec4's as uniforms...
    this._setFloatUniform('r', this._settings.wedgeColor.red);
    this._setFloatUniform('g', this._settings.wedgeColor.green);
    this._setFloatUniform('b', this._settings.wedgeColor.blue);
    this._setFloatUniform('a', this._settings.wedgeColor.alpha);

    this._setFloatUniform('rHover', this._settings.wedgeColorHover.red);
    this._setFloatUniform('gHover', this._settings.wedgeColorHover.green);
    this._setFloatUniform('bHover', this._settings.wedgeColorHover.blue);
    this._setFloatUniform('aHover', this._settings.wedgeColorHover.alpha);

    this._setFloatUniform('innerRadius', this._settings.wedgeInnerRadius / outerRadius);
  }

  // Given the angular positions of all child items, this calculates the separator angles.
  // It deletes all previous separator actors and creates new ones accordingly.
  setItemAngles(itemAngles) {

    // Destroy obsolete actors.
    this._separatorAngles = [];
    this._separators.destroy_all_children();

    // There are no separators if we have only one or no child items.
    if (itemAngles.length >= 2) {
      for (let i = 0; i < itemAngles.length; i++) {
        const startAngle = itemAngles[(i + itemAngles.length - 1) % itemAngles.length];
        let endAngle     = itemAngles[i];

        // Make sure we wrap around.
        if (endAngle < startAngle) {
          endAngle += 360;
        }

        // The separator is exactly in the middle of two items.
        const separatorAngle = (startAngle + endAngle) / 2;
        this._separatorAngles.push(separatorAngle);

        // Now create the separator actor and rotate it according to the angle.
        const separator = new Clutter.Actor({
          width: this._settings.wedgeInnerRadius + this._settings.wedgeWidth,
          height: this._settings.wedgeSeparatorWidth + 5
        });

        // Turn by 90° as 0° is up in our case.
        separator.rotation_angle_z = separatorAngle - 90;
        separator.translation_y    = -separator.height / 2;
        separator.set_pivot_point(0, 0.5);
        separator.set_content(this._separatorCanvas);
        this._separators.add_child(separator);
      }
    }
  }

  // Given the relative pointer position, this calculates the currently active child
  // wedge. The pointer position must be farther away from the center than defined by the
  // wedge-inner-radius settings key.
  setPointerPosition(x, y) {
    const distance             = Math.sqrt(x * x + y * y);
    let hoveredWedge           = -1;
    let hoveredWedgeStartAngle = 0;
    let hoveredWedgeEndAngle   = 0;

    // Nothing is hovered if the pointer is inside the inner circle.
    if (distance > this._settings.wedgeInnerRadius) {
      let angle = Math.acos(x / distance) * 180 / Math.PI;
      if (y < 0) {
        angle = 360 - angle;
      }

      // Turn 0° up.
      angle = (angle + 90) % 360;

      // Now search the wedge the pointer resides in currently.
      for (let i = 0; i < this._separatorAngles.length; i++) {
        const startAngle = this._separatorAngles[i];
        let endAngle     = this._separatorAngles[(i + 1) % this._separatorAngles.length];

        // Make sure we wrap around.
        if (endAngle < startAngle) {
          endAngle += 360;
        }

        if (angle > startAngle && angle <= endAngle ||
            angle + 360 > startAngle && angle + 360 <= endAngle) {
          hoveredWedge           = i;
          hoveredWedgeStartAngle = startAngle;
          hoveredWedgeEndAngle   = endAngle;
          break
        }
      }
    }

    // Update uniforms only if hovered wedge changed.
    if (hoveredWedge != this._hoveredWedge) {
      this._setFloatUniform('startAngle', hoveredWedgeStartAngle);
      this._setFloatUniform('endAngle', hoveredWedgeEndAngle);
      this._hoveredWedge = hoveredWedge;
      this.emit('hovered-wedge-change-event', hoveredWedge);
    }
  }

  // ----------------------------------------------------------------------- private stuff

  // Clutter.ShaderEffect.set_uniform_value() works well if floating point Numbers are
  // passed to the method. However, when you pass an integer Number, an OpenGL error
  // (1282, Invalid operation) is thrown. It seems that the implementation assumes in this
  // case that the uniform is actually of type int. Here is a crude workaround - I just
  // make sure that no integers are passed to the method!
  _setFloatUniform(name, value) {
    if (Number.isInteger(value)) {
      value += 0.0000001;
    }
    this._wedgeShader.set_uniform_value(name, value);
  }
});