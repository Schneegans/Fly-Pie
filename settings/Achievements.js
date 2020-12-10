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

    const gestureKey = 'stats-gesture-selections';
    const clickKey   = 'stats-click-selections';

    this._clickHistograms   = this._getHistograms(clickKey);
    this._gestureHistograms = this._getHistograms(gestureKey);

    this._connectStatsLabel('stats-abortions');
    this._connectStatsLabel('stats-dbus-menus');
    this._connectStatsLabel('stats-settings-opened');

    this._settings.connect('changed::stats-click-selections', () => {
      this._clickHistograms = this._getHistograms(clickKey);
      this._updateCharts();
    });

    this._settings.connect('changed::stats-gesture-selections', () => {
      this._gestureHistograms = this._getHistograms(gestureKey);
      this._updateCharts();
    });


    this._setupPieChart(this._builder.get_object('click-pie-chart'), false);
    this._setupPieChart(this._builder.get_object('gesture-pie-chart'), true);

    for (let i = 1; i <= 4; i++) {
      this._setupHistogram(this._builder.get_object('click-histogram-' + i), false, i);
      this._setupHistogram(this._builder.get_object('gesture-histogram-' + i), true, i);
    }
  }

  // ----------------------------------------------------------------------- private stuff

  _getHistograms(key) {
    const histograms = this._settings.get_value(key).deep_unpack();

    histograms.sum = 0;
    histograms.max = 0;

    for (let i = 0; i < histograms.length; i++) {
      let sum = 0;
      let max = 0;
      histograms[i].forEach(v => {
        sum += v;
        max = Math.max(max, v)
      });
      histograms[i].sum = sum;
      histograms[i].max = max;
      histograms.sum += sum;
      histograms.max = Math.max(histograms.max, max);
    }

    return histograms;
  }

  _updateCharts() {
    this._builder.get_object('gesture-pie-chart').queue_draw();
    this._builder.get_object('click-pie-chart').queue_draw();

    for (let i = 1; i <= 4; i++) {
      this._builder.get_object('click-histogram-' + i).queue_draw();
      this._builder.get_object('gesture-histogram-' + i).queue_draw();
    }
  }

  _setupPieChart(drawingArea, gestureMode) {

    drawingArea.connect('draw', (widget, ctx) => {
      const histograms = gestureMode ? this._gestureHistograms : this._clickHistograms;

      const width  = widget.get_allocated_width();
      const height = widget.get_allocated_height();
      const radius = Math.min(width, height) / 2;

      Gtk.render_background(widget.get_style_context(), ctx, 0, 0, width, height);

      const fgColor = widget.get_style_context().get_color(Gtk.StateFlags.NORMAL);
      const fxColor = widget.get_style_context().get_color(Gtk.StateFlags.LINK);
      const font = widget.get_style_context().get_property('font', Gtk.StateFlags.NORMAL);
      font.set_absolute_size(Pango.units_from_double(24));



      const layout = PangoCairo.create_layout(ctx);
      layout.set_font_description(font);
      layout.set_alignment(Pango.Alignment.CENTER);
      layout.set_text(this._formatNumber(histograms.sum), -1);
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

  _setupHistogram(drawingArea, gestureMode, depth) {

    // Draw six lines representing the wedge separators.
    drawingArea.connect('draw', (widget, ctx) => {
      const globalMax  = Math.max(this._gestureHistograms.max, this._clickHistograms.max);
      const histograms = gestureMode ? this._gestureHistograms : this._clickHistograms;
      const histogram  = histograms[depth - 1];

      const fgColor = widget.get_style_context().get_color(Gtk.StateFlags.NORMAL);
      const fxColor = widget.get_style_context().get_color(Gtk.StateFlags.LINK);
      const font = widget.get_style_context().get_property('font', Gtk.StateFlags.NORMAL);
      font.set_absolute_size(Pango.units_from_double(24));


      const width  = widget.get_allocated_width();
      const height = widget.get_allocated_height();
      Gtk.render_background(widget.get_style_context(), ctx, 0, 0, width, height);


      // const layout = PangoCairo.create_layout(ctx);
      // layout.set_font_description(font);
      // layout.set_alignment(Pango.Alignment.LEFT);
      // layout.set_text(this._formatNumber(sum), -1);
      // layout.set_width(Pango.units_from_double(widget.get_allocated_width()));
      // layout.set_height(Pango.units_from_double(widget.get_allocated_height()));

      // ctx.setSourceRGBA(fgColor.red, fgColor.green, fgColor.blue, fgColor.alpha);
      // PangoCairo.show_layout(ctx, layout);

      const bottomPadding = 20;
      const leftPadding   = 30;

      ctx.setSourceRGBA(fgColor.red, fgColor.green, fgColor.blue, 0.5);
      ctx.moveTo(leftPadding, height - bottomPadding);
      ctx.lineTo(width, height - bottomPadding);
      ctx.setLineWidth(1);
      ctx.stroke();



      if (globalMax > 0) {
        ctx.setSourceRGBA(fxColor.red, fxColor.green, fxColor.blue, fxColor.alpha);
        const barWidth = (width - leftPadding) / histogram.length;
        for (let i = 0; i < histogram.length; i++) {
          const barHeight = (histogram[i] / globalMax) * (height - bottomPadding);
          ctx.moveTo((i + 0.5) * barWidth + leftPadding, height - bottomPadding);
          ctx.lineTo(
              (i + 0.5) * barWidth + leftPadding, height - bottomPadding - barHeight);
        }
        ctx.setLineWidth(barWidth - 2);
        ctx.stroke();
      }

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