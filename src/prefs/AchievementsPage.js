//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Cairo                                    = imports.cairo;
const {Gtk, Gdk, Pango, PangoCairo, GdkPixbuf} = imports.gi;

const _ = imports.gettext.domain('flypie').gettext;

const Me    = imports.misc.extensionUtils.getCurrentExtension();
const utils = Me.imports.src.common.utils;

//////////////////////////////////////////////////////////////////////////////////////////
// The AchievementsPage class encapsulates code required for the 'Achievements' page of //
// the settings dialog. It's not instantiated multiple times, nor does it have any      //
// public interface, hence it could just be copy-pasted to the settings class. But as   //
// it's quite decoupled as well, it structures the code better when written to its own  //
// file.                                                                                //
//////////////////////////////////////////////////////////////////////////////////////////

var AchievementsPage = class AchievementsPage {

  // ------------------------------------------------------------ constructor / destructor

  constructor(builder, settings) {

    // Keep a reference to the builder and the settings.
    this._builder  = builder;
    this._settings = settings;

    // We keep several connections to the Gio.Settings object. Once the settings dialog is
    // closed, we use this array to disconnect all of them.
    this._settingsConnections = [];

    // ---------------------------------------------- Initialize the achievements sub-page

    // this._addAchievement(
    //     'Master Pielot', 'Select 100 items in less than 10 ms.', 100, 'copper', 'a');
    // this._addAchievement(
    //     'Master Pielot', 'Select 300 items in less than 20 ms.', 500, 'bronze', 'b');
    // this._addAchievement(
    //     'Master Pielot', 'Select 300 items in less than 20 ms.', 500, 'silver', 'c');
    // this._addAchievement(
    //     'Master Pielot', 'Select 500 items in less than 50 ms.', 1500, 'gold', 'd');
    // this._addAchievement(
    //     'Master Pielot', 'Select 500 items in less than 50 ms.', 1500, 'platinum',
    //     'e');
    // this._addAchievement(
    //     'Master Pielot', 'Select 500 items in less than 50 ms.', 1500, 'special', 'd');
  }

  // This should be called when the settings dialog is closed. It disconnects handlers
  // registered with the Gio.Settings object.
  destroy() {
    this._settingsConnections.forEach(connection => {
      this._settings.disconnect(connection);
    });
  }

  // ----------------------------------------------------------------------- private stuff

  // Adds an achievement to the Gtk.FlowBox. This contains a composited image and a label
  // on-top.
  _addAchievement(name, text, experience, tier, icon) {
    const box       = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, opacity: 0});
    const textLabel = new Gtk.Label(
        {label: text, justify: Gtk.Justification.CENTER, wrap: true, max_width_chars: 0});
    const xpLabel = new Gtk.Label({label: experience + ' XP', opacity: 0.5});

    box.pack_start(textLabel, false, true, 0);
    box.pack_start(xpLabel, false, true, 0);

    const image = new Gtk.DrawingArea();
    image.set_size_request(128, 128);
    image.add_events(Gdk.EventMask.ENTER_NOTIFY_MASK | Gdk.EventMask.LEAVE_NOTIFY_MASK);
    image.connect('draw', (widget, ctx) => {
      const background = GdkPixbuf.Pixbuf.new_from_file(
          Me.path + '/assets/badges/achievements/' + tier + '.svg');
      const middleground = GdkPixbuf.Pixbuf.new_from_file(
          Me.path + '/assets/badges/achievements/' + icon + '.svg');
      const foreground = GdkPixbuf.Pixbuf.new_from_file(
          Me.path + '/assets/badges/achievements/' + tier + '.png');

      Gdk.cairo_set_source_pixbuf(ctx, background, 0, 0);
      ctx.paint();

      Gdk.cairo_set_source_pixbuf(ctx, middleground, 0, 0);
      ctx.paint();

      Gdk.cairo_set_source_pixbuf(ctx, foreground, 0, 0);
      ctx.paint();


      ctx.setSourceRGBA(0, 0, 0, 0.5);
      const font = widget.get_style_context().get_property('font', Gtk.StateFlags.NORMAL);
      font.set_absolute_size(Pango.units_from_double(11));
      const layout = PangoCairo.create_layout(ctx);
      layout.set_font_description(font);
      layout.set_alignment(Pango.Alignment.CENTER);
      layout.set_width(Pango.units_from_double(128));
      layout.set_text(name, -1);
      ctx.moveTo(0, 85);
      PangoCairo.show_layout(ctx, layout);

      return false;
    });

    image.connect('enter-notify-event', (widget) => {
      box.opacity   = 1;
      image.opacity = 0.2;
    });

    image.connect('leave-notify-event', (widget) => {
      box.opacity   = 0;
      image.opacity = 1;
    });

    const grid = new Gtk.Grid();
    grid.attach(image, 0, 0, 1, 2);
    grid.attach(box, 0, 1, 1, 1);

    const flowBoxChild = new Gtk.FlowBoxChild();
    flowBoxChild.add(grid);

    this._builder.get_object('achievement-box').insert(flowBoxChild, -1);

    flowBoxChild.show_all();
  }
}