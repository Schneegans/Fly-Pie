//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const {GObject} = imports.gi;

// This class is based on the code from https://github.com/cosmoscout/cosmoscout-vr/ which
// in turn is based on code from Gnome-Pie https://github.com/Schneegans/Gnome-Pie/.

// The values describe how an animation should play out.
var AnimationDirection = {
  IN: 0,      // The beginning of the animation is slow, the end is fast.
  OUT: 1,     // The beginning of the animation is fast, the end is slow.
  IN_OUT: 2,  // The beginning and end of the animation are slow, the middle of the
              // animation is fast.
  OUT_IN: 3,  // The beginning and end of the animation are fast, the middle of the
              // animation is slow.
  LINEAR: 4   // The animation has the same speed the whole time.
};

// A class for smooth value interpolation. It animates a value between a start and an end
// value, given a start and an end time. It is also possible to define the way of
// interpolation. See AnimationDirection for more details on that.

var AnimatedValue = GObject.registerClass({
  Properties: {
    'start': GObject.ParamSpec.double(
        'start', 'start', 'The start value.', GObject.ParamFlags.READWRITE,
        Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, 0),
    'end': GObject.ParamSpec.double(
        'end', 'end', 'The end value.', GObject.ParamFlags.READWRITE,
        Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, 1),
    'startTime': GObject.ParamSpec.double(
        'startTime', 'startTime', 'The start time value.', GObject.ParamFlags.READWRITE,
        Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, 0),
    'endTime': GObject.ParamSpec.double(
        'endTime', 'endTime', 'The end time value.', GObject.ParamFlags.READWRITE,
        Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, 1),
    'exponent': GObject.ParamSpec.double(
        'exponent', 'exponent', 'The exaggeration of the animation.',
        GObject.ParamFlags.READWRITE, 0, 10, 0),
    'direction': GObject.ParamSpec.int(
        'direction', 'direction', 'The kind of animation.', GObject.ParamFlags.READWRITE,
        AnimationDirection.IN, AnimationDirection.LINEAR, AnimationDirection.LINEAR)
  },
  Signals: {}
},
                                          class AnimatedValue extends GObject.Object {
  _init(params = {}) {
    super._init(params);
  }

  // For some reason this getter and setter is required for older gjs versions... bug?
  get exponent() {
    return this._exponent || 0;
  }
  set exponent(val) {
    this._exponent = val;
  }

  // Returns true if the given time is past the end time of this.
  isFinished(time) {
    return time > this.endTime;
  }

  // Gives back an interpolated result according to the current settings and
  // given time.
  get(time) {
    if (time < this.startTime) {
      return this.start;
    }

    if (time >= this.endTime) {
      return this.end;
    }

    let state = Math.min(
        1, Math.max(0, ((time - this.startTime) / (this.endTime - this.startTime))));

    switch (this.direction) {
      case AnimationDirection.LINEAR:
        return this._updateLinear(state, this.start, this.end);
      case AnimationDirection.IN:
        return this._updateEaseIn(state, this.start, this.end);
      case AnimationDirection.OUT:
        return this._updateEaseOut(state, this.start, this.end);
      case AnimationDirection.IN_OUT:
        return this._updateEaseInOut(state, this.start, this.end);
      default:  // AnimationDirection.OUT_IN:
        return this._updateEaseOutIn(state, this.start, this.end);
    }
  }

  _mix(a, b, alpha) {
    return a * (1 - alpha) + b * alpha;
  }

  _updateLinear(a, s, e) {
    return this._mix(s, e, a);
  }

  _updateEaseIn(a, s, e) {
    return this._mix(
        s, e, (Math.pow(a, 4.0) * ((this.exponent + 1) * a - this.exponent)));
  }

  _updateEaseOut(a, s, e) {
    return this._mix(
        s, e,
        (Math.pow(a - 1, 4.0) * ((this.exponent + 1) * (a - 1) + this.exponent) + 1));
  }

  _updateEaseInOut(a, s, e) {
    if (a < 0.5) {
      return this._updateEaseIn(a * 2, s, this._mix(s, e, 0.5));
    }

    return this._updateEaseOut(a * 2 - 1, this._mix(s, e, 0.5), e);
  }

  _updateEaseOutIn(a, s, e) {
    if (a < 0.5) {
      return this._updateEaseOut(a * 2, s, this._mix(s, e, 0.5));
    }

    return this._updateEaseIn(a * 2 - 1, this._mix(s, e, 0.5), e);
  }
});
