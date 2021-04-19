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

const Me                 = imports.misc.extensionUtils.getCurrentExtension();
const utils              = Me.imports.src.common.utils;
const AchievementTracker = Me.imports.src.common.Achievements.AchievementTracker;

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

    this._achievementTracker = new AchievementTracker(this._settings);
    this._achievementTracker.connect('level-up', () => this._updateLevel());
    this._achievementTracker.connect(
        'experience-changed', () => this._updateExperience());

    this._achievementTracker.getAchievements().forEach(
        achievement => this._add(achievement));

    // Make the RadioButtons at the bottom behave like a StackSwitcher.
    const stack = this._builder.get_object('achievements-stack');
    this._builder.get_object('achievements-in-progress-button')
        .connect('toggled', button => {
          if (button.active) {
            stack.set_visible_child_name('page0');
          }
        });
    this._builder.get_object('achievements-completed-button')
        .connect('toggled', button => {
          if (button.active) {
            stack.set_visible_child_name('page1');

            // Hide the new-achievements counter when the second page is revealed.
            this._builder.get_object('achievement-counter-revealer').reveal_child = false;
          }
        });

    this._updateLevel();
    this._updateExperience();
  }

  // This should be called when the settings dialog is closed. It disconnects handlers
  // registered with the Gio.Settings object.
  destroy() {
    this._achievementTracker.destroy();
  }

  // ----------------------------------------------------------------------- private stuff

  _updateLevel() {
    const level = this._achievementTracker.getCurrentLevel();
    this._builder.get_object('level-stack').set_visible_child_name('level' + level);
  }

  _updateExperience() {
    const cur = this._achievementTracker.getLevelXP()
    const max = this._achievementTracker.getLevelMaxXP();
    this._builder.get_object('experience-label').set_label(cur + ' / ' + max + ' XP');
    this._builder.get_object('experience-bar').set_max_value(max);
    this._builder.get_object('experience-bar').set_value(cur);
  }

  // Adds an achievement to the Gtk.FlowBox. This contains a composited image and a label
  // on-top.
  _add(achievement) {

    const active    = this._createAchievementWidget(achievement, false);
    const completed = this._createAchievementWidget(achievement, true);

    this._builder.get_object('active-achievements-box').pack_start(active, true, true, 0);
    this._builder.get_object('completed-achievements-box')
        .pack_start(completed, true, true, 0);
  }

  _createAchievementWidget(achievement, completed) {
    const grid = new Gtk.Grid();

    const icon = new Gtk.DrawingArea({margin_right: 8});
    icon.set_size_request(64, 64);
    icon.connect('draw', (w, ctx) => {
      const background = GdkPixbuf.Pixbuf.new_from_file(
          Me.path + '/assets/badges/achievements/' + achievement.bgImage);
      const foreground = GdkPixbuf.Pixbuf.new_from_file(
          Me.path + '/assets/badges/achievements/' + achievement.fgImage);

      Gdk.cairo_set_source_pixbuf(ctx, background, 0, 0);
      ctx.paint();

      Gdk.cairo_set_source_pixbuf(ctx, foreground, 0, 0);
      ctx.paint();

      return false;
    });

    grid.attach(icon, 0, 0, 1, 3);

    const name = new Gtk.Label({
      label: achievement.name,
      wrap: true,
      xalign: 0,
      max_width_chars: 0,
      hexpand: true,
      valign: Gtk.Align.END
    });
    name.get_style_context().add_class('title-4');
    grid.attach(name, 1, 0, 1, 1);

    const description = new Gtk.Label({
      label: achievement.description,
      wrap: true,
      xalign: 0,
      max_width_chars: 0,
      valign: Gtk.Align.START
    });
    grid.attach(description, 1, 1, 1, 1);

    const xp =
        new Gtk.Label({label: achievement.xp + ' XP', xalign: 1, valign: Gtk.Align.END});
    xp.get_style_context().add_class('dim-label');
    xp.get_style_context().add_class('caption');
    grid.attach(xp, 2, completed ? 0 : 1, 1, 1);

    if (completed) {

      const dateLabel = new Gtk.Label(
          {label: '01.01.2021', xalign: 1, width_request: 90, valign: Gtk.Align.START});
      dateLabel.get_style_context().add_class('dim-label');
      dateLabel.get_style_context().add_class('caption');
      grid.attach(dateLabel, 2, 1, 1, 1);

    } else {

      const progressLabel = new Gtk.Label({
        label: achievement.progress + ' / ' + achievement.range[1],
        xalign: 1,
        width_request: 90
      });
      progressLabel.get_style_context().add_class('dim-label');
      progressLabel.get_style_context().add_class('caption');
      grid.attach(progressLabel, 2, 2, 1, 1);

      const progressBar = new Gtk.LevelBar({
        min_value: 0,
        max_value: achievement.range[1],
        value: achievement.progress,
        valign: Gtk.Align.CENTER
      });
      grid.attach(progressBar, 1, 2, 1, 1);
    }

    grid.show_all();

    return grid;
  }
}