//////////////////////////////////////////////////////////////////////////////////////////
//   _____       _             _____ _                                                  //
//  |   __|_ _ _|_|___ ___ ___|  _  |_|___   This software may be modified and distri-  //
//  |__   | | | | |   | . |___|   __| | -_|  buted under the terms of the MIT license.  //
//  |_____|_____|_|_|_|_  |   |__|  |_|___|  See the LICENSE file for details.          //
//                    |___|                                                             //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Cairo                                         = imports.cairo;
const {Clutter, Cogl, Gio, GObject, Graphene, GLib} = imports.gi;

const Me    = imports.misc.extensionUtils.getCurrentExtension();
const utils = Me.imports.common.utils;

//////////////////////////////////////////////////////////////////////////////////////////
// This class is instantiated once by the Menu and is responsible for drawing the       //
// wedges behind the currently active menu. The wedge beneath the mouse pointer is      //
// highlighted. Signals such as "child-hovered-event" or "parent-selected-event" are    //
// fired once the user clicks inside one of the wedges.                                 //
// This class also tracks the mouse movement and registers stroke direction changes for //
// the marking mode.                                                                    //
//                                                                                      //
// Originally I tried to implement the wedge-drawing with a huge Clutter.Canvas, but    //
// this turned out to be much to slow. Then I tried to override vfunc_paint() of the    //
// actor, but I failed to create a shader program in GJS.                               //
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
    // This is fired when the mouse pointer enters one of the wedges. The index of the
    // corresponding child is passed in as parameter. If no wedge is hovered anymore
    // (e.g. the center element is hovered) -1 will be passed in.
    "child-hovered-event":    { param_types: [GObject.TYPE_INT] },

    // This is fired when the primary mouse button is pressed inside a wedge. It will also
    // be fired if a gesture was detected (either a corner or a timeout).
    "child-selected-event":   { param_types: [GObject.TYPE_INT] },

    // Same as "child-hovered-event", but for the parent wedge.
    "parent-hovered-event":   {},

    // Same as "child-selected-event", but for the parent wedge.
    "parent-selected-event":  {},

    // This is fired if secondary mouse button is pressed. In future there might be ofter
    // reasons for this to get fired.
    "cancel-selection-event": {},
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

    // This is the index of the parent wedge.
    this._parentIndex = -1;

    // This stores information required for gesture detection.
    this._stroke = {
      start: null,         // The point where the mouse stroke began.
      end: null,           // The current end point of the stroke.
      pauseTimeout: null,  // A timeout ID which is used for stroke pause detection.
    };

    // This is attached as a child to *this* and is responsible for drawing the
    // wedge radial gradient. This is done with a Clutter.ShaderEffect as this is much
    // faster than a Clutter.Canvas.
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
      wedgeWidth:              settings.get_double('wedge-width')          * globalScale,
      wedgeInnerRadius:        settings.get_double('wedge-inner-radius')   * globalScale,
      wedgeColor:              utils.stringToRGBA(settings.get_string('wedge-color')),
      wedgeColorHover:         utils.stringToRGBA(settings.get_string('wedge-color-hover')),
      wedgeSeparatorColor:     utils.stringToRGBA(settings.get_string('wedge-separator-color')),
      wedgeSeparatorWidth:     settings.get_double('wedge-separator-width') * globalScale,
      gestureSelectionTimeout: settings.get_double('gesture-selection-timeout'),
      gestureJitterThreshold:  settings.get_double('gesture-jitter-threshold')  * globalScale,
      gestureMinStrokeLength:  settings.get_double('gesture-min-stroke-length') * globalScale,
      gestureMinStrokeAngle:   settings.get_double('gesture-min-stroke-angle'),
    };
    // clang-format on

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

  // Returns the currently hovered child's index. Returns -1 if either no wedge or the
  // parent wedge is currently hovered.
  getHoveredChild() {
    if (this._hoveredWedge < 0 || this._parentIndex < 0) {
      return this._hoveredWedge;
    }

    if (this._parentIndex == this._hoveredWedge) {
      return -1;
    }

    // There is a parent wedge - we have to decrease all indices after the parent wedge by
    // one.
    return (this._hoveredWedge > this._parentIndex) ? this._hoveredWedge - 1 :
                                                      this._hoveredWedge;
  }

  // Given the angular positions of all child items, this calculates the separator angles.
  // It deletes all previous separator actors and creates new ones accordingly. The
  // itemAngles array should be sorted, but the smallest value has not to be at the start.
  // That means, the smallest value can be somewhere in the list, all following angles
  // should be monotonically increasing continuing at the start of the list (in a
  // ring-like fashion).
  setItemAngles(itemAngles, parentAngle) {

    this._hoveredWedge = -1;
    this._parentIndex  = -1;

    this._setFloatUniform('startAngle', 0);
    this._setFloatUniform('endAngle', 0);

    // If a parentAngle is given, we have to insert it into the list. Due to the ring-like
    // sorting of the itemAngles, this is surprisingly involved.
    if (parentAngle != undefined) {
      for (let i = 0; i <= itemAngles.length; i++) {
        let doInsertion = false;

        // Insert it definitely if we reached the end of the list.
        if (i == itemAngles.length) {
          doInsertion = true;

        } else if (i > 0) {
          if (itemAngles[i - 1] < parentAngle && parentAngle < itemAngles[i]) {
            doInsertion = true;
          }

          if (itemAngles[i - 1] > itemAngles[i]) {
            if (parentAngle < itemAngles[i]) doInsertion = true;
            if (parentAngle > itemAngles[i - 1]) doInsertion = true;
          }
        }

        // We found the index to insert it.
        if (doInsertion) {
          this._parentIndex = i;
          itemAngles.splice(i, 0, parentAngle);
          break;
        }
      }
    }

    // Destroy obsolete actors. We could re-use existing ones, but they seem to be quite
    // cheap to construct.
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

  // This is called by the Menu when the user clicks somewhere on the background. It fires
  // either 'parent-selected-event' or 'child-selected-event' if the corresponding wedge
  // is hovered or 'cancel-selection-event' if the secondary mouse button is pressed.
  onButtonReleaseEvent(event) {
    if (event.get_button() == 1) {
      this._emitSelection();

    } else if (event.get_button() == 3) {
      this.emit('cancel-selection-event');
    }
  }

  // Given the relative pointer position, this calculates the currently active child
  // wedge. For a wedge to become active, the pointer position must be farther away from
  // the center than defined by the wedge-inner-radius settings key.
  // It emits the 'parent-hovered-event' and 'child-hovered-event' signals when the
  // hovered wedge changes.
  // It also tracks the motion of the mouse while the left mouse button is pressed and
  // emits selection events when a stroke corner or a pause in the motion is detected.
  onMotionEvent(event) {
    const [screenX, screenY] = event.get_coords();
    const [ok, x, y]         = this.transform_stage_point(screenX, screenY);

    const distance             = Math.sqrt(x * x + y * y);
    let hoveredWedge           = -1;
    let hoveredWedgeStartAngle = 0;
    let hoveredWedgeEndAngle   = 0;

    // There is only something hovered if the pointer is outside the inner circle.
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

      if (hoveredWedge >= 0 && hoveredWedge == this._parentIndex) {
        this.emit('parent-hovered-event');
      } else {
        this.emit('child-hovered-event', this.getHoveredChild());
      }
    }

    // Now we try to detect gestures. Consider the diagram below:
    //
    //                                  M
    //                                .
    //                              .
    //     S -------------------- E
    //
    // The mouse button was pressed at S (_stroke.start) and the moved to E (_stroke.end).
    // When the next motion event comes in (M) and the left button is still pressed, we
    // compare the directions of S->E with E->M. If they differ significantly, this is
    // considered a corner. There are some minimum lengths for both vectors - if they are
    // not long enough, nothing is done. If E->M is long enough, but there is no corner, E
    // is set to M and we wait for the next motion event.
    if (event.get_state() & Clutter.ModifierType.BUTTON1_MASK) {

      // Storethe current mouse position.
      const mouse = new Graphene.Vec2();
      mouse.init(screenX, screenY);

      if (this._stroke.start == null) {

        // It's the first event of this gesture, so we store the current mouse position as
        // start and end. There is nothing more to be done.
        this._stroke.start = new Graphene.Vec2();
        this._stroke.start.init_from_vec2(mouse);

        this._stroke.end = new Graphene.Vec2();
        this._stroke.end.init_from_vec2(mouse);

      } else {

        // Calculate the vector S->E in the diagram above.
        const strokeDir    = this._stroke.end.subtract(this._stroke.start);
        const strokeLength = strokeDir.length();

        if (strokeLength > this._settings.gestureMinStrokeLength) {

          // Calculate the vector E->M in the diagram above.
          const tipDir    = mouse.subtract(this._stroke.end);
          const tipLength = tipDir.length();

          if (tipLength > this._settings.gestureJitterThreshold) {

            // If the tip vector is long enough, the pointer was not stationary. Remove
            // the timer again.
            if (this._stroke.pauseTimeout != null) {
              GLib.source_remove(this._stroke.pauseTimeout);
              this._stroke.pauseTimeout = null;
            }

            // Update the point M in the diagram above to be the new E for the next motion
            // event.
            this._stroke.end.init_from_vec2(mouse);

            // Now compute the angle between S->E and E->M.
            const angle = Math.acos(
                tipDir.scale(1 / tipLength).dot(strokeDir.scale(1 / strokeLength)));

            //  Emit the selection events if it exceeds the configured threshold.
            if (angle * 180 / Math.PI > this._settings.gestureMinStrokeAngle) {
              this._emitSelection();
            }
          }

          // The stroke is long enough to become a gesture. We register a timer to detect
          // pause-events where the pointer was stationary for some time. These events
          // also lead to selections.
          if (this._stroke.pauseTimeout == null) {
            this._stroke.pauseTimeout = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT, this._settings.gestureSelectionTimeout, () => {
                  this._emitSelection();
                  return false;
                });
          }

        } else {

          // The vector S->E is not long enough to be a gesture, so we only update the end
          // point.
          this._stroke.end.init_from_vec2(mouse);
        }
      }
    } else {

      // The mouse button is not pressed anymore, so we can abort gesture detection.
      this._resetStroke();
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

  // Small helper method which either emits 'parent-selected-event' or
  // 'child-selected-event' depending on the currently hovered wedge. It also resets the
  // current gesture detection.
  _emitSelection() {
    this._resetStroke();

    if (this._hoveredWedge >= 0) {
      if (this._hoveredWedge == this._parentIndex) {
        this.emit('parent-selected-event');
      } else {
        this.emit('child-selected-event', this.getHoveredChild());
      }
    }
  }

  // Resets the current gesture detection. This is done when an item was selected or the
  // mouse pointer released.
  _resetStroke() {
    if (this._stroke.pauseTimeout != null) {
      GLib.source_remove(this._stroke.pauseTimeout);
      this._stroke.pauseTimeout = null;
    }

    this._stroke.start = null;
    this._stroke.end   = null;
  }
});