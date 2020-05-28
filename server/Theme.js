//////////////////////////////////////////////////////////////////////////////////////////
//                                                                                      //
//    _____                    ___  _     ___       This software may be modified       //
//   / ___/__  ___  __ _  ___ / _ \(_)__ |_  |      and distributed under the           //
//  / (_ / _ \/ _ \/  ' \/ -_) ___/ / -_) __/       terms of the MIT license. See       //
//  \___/_//_/\___/_/_/_/\__/_/  /_/\__/____/       the LICENSE file for details.       //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const GObject = imports.gi.GObject;

//////////////////////////////////////////////////////////////////////////////////////////

const doubleProperty = function(name, min, max, def) {
  return GObject.ParamSpec.double(
      name, name, name, GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT, min,
      max, def);
};

const stringProperty = function(name, def) {
  return GObject.ParamSpec.string(
      name, name, name, GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT, def);
};

//////////////////////////////////////////////////////////////////////////////////////////

// clang-format off
var Theme = GObject.registerClass({
  Properties: {
    'scale':            doubleProperty('scale',            0.5, 5.0, 1.0),
    'iconMargin':       doubleProperty('iconMargin',       0.0, 1.0, 0.3),
    'childIconMargin':  doubleProperty('childIconMargin',  0.0, 1.0, 0.1),
    'menuColor':        stringProperty('menuColor',        'rgba(100, 100, 100, 0.8)'),
    'backgroundColor':  stringProperty('backgroundColor',  'rgba(0, 0, 0, 0.2)')
  }
},
class Theme extends GObject.Object {});
// clang-format on