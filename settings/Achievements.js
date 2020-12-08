//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Cairo                    = imports.cairo;
const {Gtk, Pango, PangoCairo} = imports.gi;

const _ = imports.gettext.domain('flypie').gettext;

const Me    = imports.misc.extensionUtils.getCurrentExtension();
const utils = Me.imports.common.utils;

//////////////////////////////////////////////////////////////////////////////////////////
// The Achievements class encapsulates code required for the 'Achievements' page of the //
// settings dialog. It's not instantiated multiple times, nor does it have any public   //
// interface, hence it could just be copy-pasted to the settings class. But as it's     //
// quite decoupled as well, it structures the code better when written to its own file. //
//////////////////////////////////////////////////////////////////////////////////////////

var Achievements = class Achievements {

  // ------------------------------------------------------------ constructor / destructor

  constructor(builder, settings) {

    // Keep a reference to the builder and the settings.
    this._builder  = builder;
    this._settings = settings;

    this._connectStatsLabel('stats-abortions');
    this._connectStatsLabel('stats-dbus-menus');
    this._connectStatsLabel('stats-settings-opened');

    this._settings.connect(
        'changed::stats-point-and-click-selections',
        () => this._updatePointAndClickCharts());

    this._settings.connect(
        'changed::stats-gesture-selections', () => this._updateGestureCharts());

    this._setupPointAndClickCharts();
    this._setupGestureCharts();
  }

  // ----------------------------------------------------------------------- private stuff


  _setupPointAndClickCharts() {
    this._setupPieChart(
        this._builder.get_object('point-and-click-pie-chart'),
        'stats-point-and-click-selections');

    for (let i = 1; i <= 4; i++) {
      this._setupHistogram(
          this._builder.get_object('point-and-click-histogram-' + i),
          'stats-point-and-click-selections', i);
    }
  }


  _updatePointAndClickCharts() {
    this._builder.get_object('point-and-click-pie-chart').queue_draw();

    for (let i = 1; i <= 4; i++) {
      this._builder.get_object('point-and-click-histogram-' + i).queue_draw();
    }
  }



  _setupGestureCharts() {
    this._setupPieChart(
        this._builder.get_object('gesture-pie-chart'), 'stats-gesture-selections');

    for (let i = 1; i <= 4; i++) {
      this._setupHistogram(
          this._builder.get_object('gesture-histogram-' + i), 'stats-gesture-selections',
          i);
    }
  }

  _updateGestureCharts() {
    this._builder.get_object('gesture-pie-chart').queue_draw();

    for (let i = 1; i <= 4; i++) {
      this._builder.get_object('gesture-histogram-' + i).queue_draw();
    }
  }

  _setupPieChart(drawingArea, dataKey) {

    drawingArea.connect('draw', (widget, ctx) => {
      const histograms = this._settings.get_value(dataKey).deep_unpack();

      const depthSums = [];
      let totalSum    = 0;

      for (let i = 0; i < histograms.length; i++) {
        let sum = 0;
        histograms[i].forEach(v => sum += v);
        depthSums.push(sum);
        totalSum += sum;
      }

      const width  = widget.get_allocated_width();
      const height = widget.get_allocated_height();
      const radius = Math.min(width, height) / 2;

      ctx.setOperator(Cairo.Operator.CLEAR);
      ctx.paint();
      ctx.setOperator(Cairo.Operator.OVER);

      const fgColor = widget.get_style_context().get_color(Gtk.StateFlags.NORMAL);
      const fxColor = widget.get_style_context().get_color(Gtk.StateFlags.LINK);
      const font = widget.get_style_context().get_property('font', Gtk.StateFlags.NORMAL);
      font.set_absolute_size(Pango.units_from_double(24));



      const layout = PangoCairo.create_layout(ctx);
      layout.set_font_description(font);
      layout.set_alignment(Pango.Alignment.CENTER);
      layout.set_text(this._formatNumber(totalSum), -1);
      layout.set_width(Pango.units_from_double(width));

      const extents = layout.get_pixel_extents()[1];
      ctx.moveTo(0, (height - extents.height) / 2);
      ctx.setSourceRGBA(fgColor.red, fgColor.green, fgColor.blue, fgColor.alpha);

      PangoCairo.show_layout(ctx, layout);


      ctx.setSourceRGBA(fxColor.red, fxColor.green, fxColor.blue, fxColor.alpha);
      ctx.moveTo(width * 0.5, height * 0.5 - radius * 0.8);
      ctx.arc(width * 0.5, height * 0.5, radius * 0.8, -0.5 * Math.PI, 1.5 * Math.PI);
      ctx.setLineWidth(5);
      ctx.stroke();

      return false;
    });
  }

  _setupHistogram(drawingArea, dataKey, depth) {

    // Draw six lines representing the wedge separators.
    drawingArea.connect('draw', (widget, ctx) => {
      const histograms = this._settings.get_value(dataKey).deep_unpack();

      let sum = 0;
      histograms[depth - 1].forEach(v => sum += v);

      const fgColor = widget.get_style_context().get_color(Gtk.StateFlags.NORMAL);
      const fxColor = widget.get_style_context().get_color(Gtk.StateFlags.LINK);
      const font = widget.get_style_context().get_property('font', Gtk.StateFlags.NORMAL);
      font.set_absolute_size(Pango.units_from_double(24));

      ctx.setOperator(Cairo.Operator.CLEAR);
      ctx.paint();
      ctx.setOperator(Cairo.Operator.OVER);

      ctx.setSourceRGBA(fgColor.red, fgColor.green, fgColor.blue, fgColor.alpha);
      // ctx.arc(size * 0.25, size * 0.25, size * 0.1, 0, 2 * Math.PI);
      // ctx.fill();

      const layout = PangoCairo.create_layout(ctx);
      layout.set_font_description(font);
      layout.set_alignment(Pango.Alignment.LEFT);
      layout.set_text(this._formatNumber(sum), -1);
      layout.set_width(Pango.units_from_double(widget.get_allocated_width()));
      layout.set_height(Pango.units_from_double(widget.get_allocated_height()));

      PangoCairo.show_layout(ctx, layout);

      return false;
    });
  }

  _connectStatsLabel(key) {
    this._builder.get_object(key).label =
        this._formatNumber(this._settings.get_uint(key).toString());

    this._settings.connect('changed::' + key, () => {
      this._builder.get_object(key).label =
          this._formatNumber(this._settings.get_uint(key).toString());
    });
  }

  _formatNumber(number) {
    return number >= 1000 ? (number / 1000).toFixed(1) + 'k' : number.toString();
  }
}