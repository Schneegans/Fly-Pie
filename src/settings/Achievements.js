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
const utils = Me.imports.src.common.utils;

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

    // We keep several connections to the Gio.Settings object. Once the settings dialog is
    // closed, we use this array to disconnect all of them.
    this._settingsConnections = [];

    // ---------------------------------------------- Initialize the achievements sub-page


    // ------------------------------------------------ Initialize the statistics sub-page

    // Show some statistics at the bottom of the statistics page.
    this._connectStatsLabel('stats-abortions');
    this._connectStatsLabel('stats-dbus-menus');
    this._connectStatsLabel('stats-settings-opened');

    // These are the settings schema keys storing the selection statistics. They contain
    // an array of selection time histograms, one for each selection depth (depth 1, 2, 3,
    // and 4 - all selections deeper than 4 are recorded in the last histogram).
    const gestureKey = 'stats-gesture-selections';
    const clickKey   = 'stats-click-selections';

    // This object contains information required to draw the charts of the statistics
    // page.
    this._charts = {
      clicks: {
        // Translators: This is a label how often a click selection was made.
        name: _('Click Selections'),                  // Shown when nothing is hovered
        // Translators: Do not translate '%i' - it will be replaced by a number.
        hoveredName: _('Level-%i Click Selections'),  // Shown when a histogram is hovered
        pieWidget: this._setupPieChart('clicks'),     // A Gtk.DrawingArea
        histogramWidgets: [                           // Four Gtk.DrawingAreas
          this._setupHistogram('clicks', 1), this._setupHistogram('clicks', 2),
          this._setupHistogram('clicks', 3), this._setupHistogram('clicks', 4)
        ],
        data: null,          // This will contain the selection data from the Gio.Settings
        sum: {total: 0, perLevel: []},  // These numbers are updated in _updateChartData()
        max: {total: 0, perLevel: []}   // These numbers are updated in _updateChartData()
      },
      gestures: {
        // Translators: This is a label how often a gesture selection was made.
        name: _('Gesture Selections'),                // Shown when nothing is hovered
        // Translators: Do not translate '%i' - it will be replaced by a number.
        hoveredName: _('Level-%i Gesture Selections'),// Shown when a histogram is hovered
        pieWidget: this._setupPieChart('gestures'),   // A Gtk.DrawingArea
        histogramWidgets: [                           // Four Gtk.DrawingAreas
          this._setupHistogram('gestures', 1), this._setupHistogram('gestures', 2),
          this._setupHistogram('gestures', 3), this._setupHistogram('gestures', 4)
        ],
        data: null,          // This will contain the selection data from the Gio.Settings
        sum: {total: 0, perLevel: []},  // These numbers are updated in _updateChartData()
        max: {total: 0, perLevel: []}   // These numbers are updated in _updateChartData()
      }
    };

    // If the click-selections statistics key changes (that means that the user selected
    // something by point-and-click), redraw the corresponding charts.
    this._settingsConnections.push(
        this._settings.connect('changed::stats-click-selections', () => {
          this._updateChartData(this._charts['clicks'], clickKey);
          this._redrawCharts();
        }));

    // If the gesture-selections statistics key changes (that means that the user selected
    // something with a gesture), redraw the corresponding charts.
    this._settingsConnections.push(
        this._settings.connect('changed::stats-gesture-selections', () => {
          this._updateChartData(this._charts['gestures'], gestureKey);
          this._redrawCharts();
        }));

    // Initially get the data for the charts.
    this._updateChartData(this._charts['clicks'], clickKey);
    this._updateChartData(this._charts['gestures'], gestureKey);
  }

  // This should be called when the settings dialog is closed. It disconnects handlers
  // registered with the Gio.Settings object.
  destroy() {
    this._settingsConnections.forEach(connection => {
      this._settings.disconnect(connection);
    });
  }

  // ----------------------------------------------------------------------- private stuff

  // Retrieves the selection data from the Gio.Settings and computes some maxima and sums.
  // These values are then used when drawing the pie charts and the histograms. The data
  // is written to the corresponding properties of the given charts object. See the
  // constructor of this class for an explanation on how this object looks like.
  _updateChartData(charts, settingsKey) {

    // Retrieve the nested array of histograms.
    charts.data = this._settings.get_value(settingsKey).deep_unpack();

    // Reset the properties we will be writing to.
    charts.sum = {total: 0, perLevel: []};
    charts.max = {total: 0, perLevel: []};

    // Iterate through all depth histograms.
    for (let i = 0; i < charts.data.length; i++) {
      let sum = 0;
      let max = 0;

      // Compute the sum and maximum value for the current histogram.
      charts.data[i].forEach(v => {
        sum += v;
        max = Math.max(max, v)
      });

      // Store the result, once for the entire dataset, once for the current level.
      charts.sum.total += sum;
      charts.max.total = Math.max(charts.max.total, max);
      charts.sum.perLevel.push(sum);
      charts.max.perLevel.push(max);
    }
  }

  // Calls queue_draw() on all Gtk.DrawingAreas of the statistics page.
  _redrawCharts() {
    for (const type in this._charts) {
      this._charts[type].pieWidget.queue_draw();
      this._charts[type].histogramWidgets.forEach((h) => h.queue_draw());
    }
  }

  // Sets up the drawing routine for one of the two pie charts shown at the top of
  // statistics page. This method returns a reference to the Gtk.DrawingArea of the pie
  // chart.
  _setupPieChart(type) {

    // Get the Gtk.DrawingArea.
    const drawingArea = this._builder.get_object(type + '-pie-chart');

    drawingArea.connect('draw', (widget, ctx) => {
      // Get the data for the pie chart.
      const charts = this._charts[type];

      // Get the size of the drawing area and allocate some space below the pie chart for
      // the caption.
      const bottomPadding = 20;
      const width         = widget.get_allocated_width();
      const height        = widget.get_allocated_height() - bottomPadding;

      // First we render the background of the widget.
      Gtk.render_background(widget.get_style_context(), ctx, 0, 0, width, height);

      // Get some values we will use more often. fgColor will be used for text and thin
      // lines, fxColor will be used for the actual rings of the pie charts.
      const fgColor = widget.get_style_context().get_color(Gtk.StateFlags.NORMAL);
      const fxColor = widget.get_style_context().get_color(Gtk.StateFlags.LINK);

      // Draw the caption below the pie chart.
      const font = widget.get_style_context().get_property('font', Gtk.StateFlags.NORMAL);
      font.set_weight(Pango.Weight.BOLD);
      const layout = PangoCairo.create_layout(ctx);
      layout.set_font_description(font);
      layout.set_alignment(Pango.Alignment.CENTER);
      layout.set_width(Pango.units_from_double(width));

      ctx.setSourceRGBA(fgColor.red, fgColor.green, fgColor.blue, fgColor.alpha);
      ctx.moveTo(0, height + 2);

      let text = charts.name;
      for (let i = 0; i < charts.histogramWidgets.length; i++) {
        if (charts.histogramWidgets[i]._hovered) {
          // Get the name of the hovered histogram (if any).
          text = charts.hoveredName.replace('%i', i + 1);
        }
      }

      layout.set_text(text, -1);
      PangoCairo.show_layout(ctx, layout);


      // Now draw the number inside the pie chart.
      let number = charts.sum.total;
      for (let i = 0; i < charts.histogramWidgets.length; i++) {
        if (charts.histogramWidgets[i]._hovered) {
          // Get the sum of the hovered histogram (if any).
          number = charts.sum.perLevel[i];
        }
      }

      layout.set_text(this._formatNumber(number), -1);
      font.set_absolute_size(Pango.units_from_double(24));
      font.set_weight(Pango.Weight.NORMAL);
      layout.set_font_description(font);

      const extents = layout.get_pixel_extents()[1];
      ctx.moveTo(0, (height - extents.height) / 2);

      PangoCairo.show_layout(ctx, layout);

      // Finally draw the individual arcs of the pie chart. We only need to do this if
      // there are any selections.
      if (charts.sum.total > 0) {

        // Compute the radius for the pie chart. The radius is based on the number of
        // selections recorded for this pie chart relative to the total number of
        // selections. The maximum radius is bounded by the available space in the widget;
        // the minimum radius is half of the maximum value.
        const gestureSelections = this._charts.gestures.sum.total;
        const clickSelections   = this._charts.clicks.sum.total;
        const maxSelections     = Math.max(gestureSelections, clickSelections);

        const maxRadius = Math.min(width, height) / 2;
        const minRadius = 0.5 * maxRadius;
        const r =
            (charts.sum.total / maxSelections) * (maxRadius - minRadius) + minRadius;

        ctx.translate(width * 0.5, height * 0.5);
        let startAngle = -0.5 * Math.PI;

        for (let i = 0; i < charts.data.length; i++) {
          const endAngle =
              startAngle + (charts.sum.perLevel[i] / charts.sum.total) * 2.0 * Math.PI;
          ctx.moveTo(Math.cos(startAngle) * r * 0.9, Math.sin(startAngle) * r * 0.9);

          // Increase the line width of the hovered arc.
          let lineWidth = 8;
          if (charts.histogramWidgets[i]._hovered) {
            lineWidth = 12;
            ctx.setSourceRGBA(fgColor.red, fgColor.green, fgColor.blue, 0.7);
          } else {
            const alpha = 1.0 - i / charts.data.length;
            ctx.setSourceRGBA(fxColor.red, fxColor.green, fxColor.blue, alpha);
          }

          ctx.arc(0, 0, r * 0.9, startAngle, endAngle);
          ctx.setLineWidth(lineWidth);
          ctx.stroke();

          // Draw a thin line separating the arcs.
          ctx.setSourceRGBA(fgColor.red, fgColor.green, fgColor.blue, fgColor.alpha);
          ctx.moveTo(Math.cos(startAngle) * r, Math.sin(startAngle) * r);
          ctx.lineTo(Math.cos(startAngle) * r * 0.8, Math.sin(startAngle) * r * 0.8);
          ctx.setLineWidth(1);
          ctx.stroke();

          startAngle = endAngle;
        }
      }

      return false;
    });

    return drawingArea;
  }

  // Sets up the drawing routine for one of the eight histograms shown in statistics page.
  // This method returns a reference to the Gtk.DrawingArea of the histogram.
  _setupHistogram(type, depth) {
    // Get the Gtk.DrawingArea.
    const drawingArea = this._builder.get_object(type + '-histogram-' + depth);

    // Whenever the mouse pointer enters one of the histogram charts, we set a _hovered
    // property to true. When the mouse pointer leaves the histogram, it's set to false
    // again. This property is then used during drawing of the histograms and the
    // corresponding pie charts.
    drawingArea.connect('enter-notify-event', (widget) => {
      widget._hovered = true;
      this._redrawCharts();
    });

    drawingArea.connect('leave-notify-event', (widget) => {
      widget._hovered = false;
      this._redrawCharts();
    });

    drawingArea.connect('draw', (widget, ctx) => {
      // Get the data for the pie chart.
      const charts    = this._charts[type];
      const histogram = charts.data[depth - 1];

      // Get some values we will use more often. fgColor will be used for text and thin
      // lines, fxColor will be used for the actual bars of the histogram.
      const fgColor = widget.get_style_context().get_color(Gtk.StateFlags.NORMAL);
      const fxColor = widget.get_style_context().get_color(Gtk.StateFlags.LINK);


      // Get the size of the drawing area. The histogram chart will use some padding
      // around to add some spacing to neighboring charts.
      const width         = widget.get_allocated_width();
      const height        = widget.get_allocated_height();
      const topPadding    = 10;
      const bottomPadding = 20;
      const leftPadding   = 15;
      const rightPadding  = 15;

      // First we render the background of the widget.
      Gtk.render_background(widget.get_style_context(), ctx, 0, 0, width, height);

      // Then draw the bottom axis.
      ctx.setSourceRGBA(fgColor.red, fgColor.green, fgColor.blue, 0.4);
      ctx.moveTo(leftPadding, height - bottomPadding);
      ctx.lineTo(width - rightPadding, height - bottomPadding);
      ctx.setLineWidth(1);
      ctx.stroke();

      // Then the thin vertical lines.
      const maxSeconds = 5;
      for (let i = 0; i <= maxSeconds; i++) {
        const gap = (width - leftPadding - rightPadding - 2) / maxSeconds;
        ctx.moveTo(leftPadding + i * gap + 1, topPadding);
        ctx.lineTo(leftPadding + i * gap + 1, height - bottomPadding + 3);
      }

      ctx.setSourceRGBA(fgColor.red, fgColor.green, fgColor.blue, 0.2);
      ctx.setLineWidth(0.5);
      ctx.stroke();

      // Then draw the tiny labels for the bottom axis.
      if (widget._hovered) {
        ctx.setSourceRGBA(fgColor.red, fgColor.green, fgColor.blue, 0.5);
      } else {
        ctx.setSourceRGBA(fgColor.red, fgColor.green, fgColor.blue, 0.3);
      }

      const font = widget.get_style_context().get_property('font', Gtk.StateFlags.NORMAL);
      font.set_absolute_size(Pango.units_from_double(9));

      for (let i = 0; i <= maxSeconds; i++) {
        const gap = (width - leftPadding - rightPadding - 2) / maxSeconds;
        ctx.moveTo(leftPadding + i * gap - 5, height - bottomPadding + 1);

        const layout = PangoCairo.create_layout(ctx);
        layout.set_font_description(font);
        layout.set_alignment(Pango.Alignment.CENTER);
        layout.set_text(i + 's', -1);
        PangoCairo.show_layout(ctx, layout);
      }

      // Finally draw the actual histogram lines. We first get the bin with the most
      // selection over all histograms. This is used to scale all histograms equally.
      const gestureSelections = this._charts.gestures.max.total;
      const clickSelections   = this._charts.clicks.max.total;
      const maxSelections     = Math.max(gestureSelections, clickSelections);

      // Only attempt to draw anything if there are selections at all.
      if (maxSelections > 0) {

        if (widget._hovered) {
          ctx.setSourceRGBA(fgColor.red, fgColor.green, fgColor.blue, 0.7);
        } else {
          ctx.setSourceRGBA(fxColor.red, fxColor.green, fxColor.blue, fxColor.alpha);
        }

        const barWidth = (width - leftPadding - rightPadding) / histogram.length;
        for (let i = 0; i < histogram.length; i++) {
          const barHeight =
              (histogram[i] / maxSelections) * (height - bottomPadding - topPadding);
          ctx.moveTo((i + 0.5) * barWidth + leftPadding, height - bottomPadding);
          ctx.lineTo(
              (i + 0.5) * barWidth + leftPadding, height - bottomPadding - barHeight);
        }
        ctx.setLineWidth(barWidth - 2);
        ctx.stroke();
      }

      return false;
    });

    return drawingArea;
  }

  // Shows the current value stored in Fly-Pie's settings under the given key with a
  // label. The label must use the same key as ID in the glade file. Whenever the settings
  // value changes, the label's text is updated automatically.
  _connectStatsLabel(key) {
    this._builder.get_object(key).label =
        this._formatNumber(this._settings.get_uint(key).toString());

    // Update on change.
    this._settingsConnections.push(this._settings.connect('changed::' + key, () => {
      this._builder.get_object(key).label =
          this._formatNumber(this._settings.get_uint(key).toString());
    }));
  }

  // Tiny helper method which appends a 'k' to the given number if it's greater than 999.
  _formatNumber(number) {
    return number >= 1000 ? (number / 1000).toFixed(1) + 'k' : number.toString();
  }
}