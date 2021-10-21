//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Gtk = imports.gi.Gtk;

const _ = imports.gettext.domain('flypie').gettext;

const Me           = imports.misc.extensionUtils.getCurrentExtension();
const utils        = Me.imports.src.common.utils;
const Achievements = Me.imports.src.common.Achievements;

//////////////////////////////////////////////////////////////////////////////////////////
// The AchievementsPage class encapsulates code required for the 'Achievements' page of //
// the settings dialog. It's not instantiated multiple times, nor does it have any      //
// public interface, hence it could just be copy-pasted to the PreferencesDialog class. //
// But as it's quite decoupled as well, it structures the code better when written to   //
// its own file.                                                                        //
//////////////////////////////////////////////////////////////////////////////////////////

var AchievementsPage = class AchievementsPage {

  // ------------------------------------------------------------ constructor / destructor

  constructor(builder, settings) {

    // Keep a reference to the builder and the settings.
    this._builder  = builder;
    this._settings = settings;

    // We keep several connections to the Gio.Settings object. Once the settings
    // dialog is closed, we use this array to disconnect all of them.
    this._settingsConnections = [];

    // Create an instance of the achievements class. This will track the progress of each
    // individual achievement and notify us of any important changes. If something
    // happens, the signals below are emitted.
    this._achievements = new Achievements.Achievements(this._settings);
    this._achievements.connect('level-changed', () => this._updateLevel());
    this._achievements.connect('experience-changed', () => this._updateExperience());
    this._achievements.connect(
        'progress-changed', (o, id, cur, max) => this._updateProgress(id, cur, max));
    this._achievements.connect('unlocked', (o, id) => this._achievementUnlocked(id));
    this._achievements.connect('locked', (o, id) => this._achievementLocked(id));
    this._achievements.connect('completed', (o, id) => this._achievementCompleted(id));

    // Now we add all achievements to the user interface. There are two lists, one for the
    // active achievements and one for the completed achievements. Both lists contain
    // widgets for all achievements at all times, but only the relevant widgets are shown.
    // All others are hidden via Gtk.Revealers.

    // The objects below map achievement IDs to some widget pointers, such as the
    // corresponding Gtk.Revealer or the Gtk.LevelBar. The structure of each element is
    // outlined below.
    this._activeAchievements = {
        // <Achievement ID>: {
        //   name:          "<Achievement Name>",        // This is used for sorting.
        //   progress:      <number>,                    // This is used for sorting.
        //   progressLabel: Gtk.Label,
        //   progressBar:   Gtk.LevelBar,
        //   revealer:      Gtk.Revealer
        // }
    };
    this._completedAchievements = {
        // <Achievement ID>: {
        //   name:      "<Achievement Name>",            // This is used for sorting.
        //   date:      <JavaScript Date Object>,        // This is used for sorting.
        //   dateLabel: Gtk.Label,
        //   revealer:  Gtk.Revealer
        // }
    };

    // Create all achievement widgets filling the objects above.
    this._achievements.getAchievements().forEach(
        (achievement, id) => this._add(achievement, id));

    // Sort achievement widgets according to name, progress and date.
    this._reorderActiveAchievements();
    this._reorderCompletedAchievements();

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
            this._settings.set_uint('stats-unread-achievements', 0);
          }
        });

    // Update the new-achievements counter.
    this._settingsConnections.push(this._settings.connect(
        'changed::stats-unread-achievements', () => this._updateCounter()));

    // Reset all statistics when the red button is pressed.
    this._builder.get_object('achievements-reset-button').connect('clicked', button => {
      // Create the question dialog.
      const dialog = new Gtk.MessageDialog({
        transient_for: utils.getRoot(button),
        modal: true,
        buttons: Gtk.ButtonsType.OK_CANCEL,
        message_type: Gtk.MessageType.QUESTION,
        text: _('Do you really want to reset all statistics?'),
        secondary_text: _('All achievements will be lost!')
      });

      // Reset all stats-* keys on a positive response.
      dialog.connect('response', (dialog, id) => {
        if (id == Gtk.ResponseType.OK) {
          this._settings.settings_schema.list_keys().forEach(key => {
            if (key.startsWith('stats-')) {
              this._settings.reset(key);
            }
          });
        }
        dialog.destroy();
      });

      if (utils.gtk4()) {
        dialog.show();
      } else {
        dialog.show_all();
      }
    });

    // Initialize the user interface with the current setting values.
    this._updateLevel();
    this._updateExperience();
    this._updateCounter();
  }

  // This should be called when the settings dialog is closed. It disconnects handlers
  // registered with the Gio.Settings object.
  destroy() {
    this._achievements.destroy();

    this._settingsConnections.forEach(connection => {
      this._settings.disconnect(connection);
    });
  }

  // ----------------------------------------------------------------------- private stuff

  // This updates the big level badge according to the current level as reported by the
  // Achievements class.
  _updateLevel() {
    const level = this._achievements.getCurrentLevel();
    this._builder.get_object('level-stack').set_visible_child_name('level' + level);
  }

  // This updates the level progress bar and the experience label according to the data
  // from the Achievements class.
  _updateExperience() {
    const cur = this._achievements.getLevelXP()
    const max = this._achievements.getLevelMaxXP();
    this._builder.get_object('experience-label').set_label(cur + ' / ' + max + ' XP');
    this._builder.get_object('experience-bar').set_max_value(max);
    this._builder.get_object('experience-bar').set_value(cur);
  }

  // This updates the progress bar and progress label of the achievement with the given ID
  // to the given values. It will also reorder the active achievements list accordingly.
  _updateProgress(id, cur, max) {
    this._activeAchievements[id].progressBar.set_value(cur);
    this._activeAchievements[id].progressLabel.set_label(cur + ' / ' + max);
    this._activeAchievements[id].progress = cur / max;

    this._reorderActiveAchievements();
  }

  // This updates the small new-achievements counter at the bottom. It will be hidden if
  // the number of new achievements is zero.
  _updateCounter() {
    const count  = this._settings.get_uint('stats-unread-achievements');
    const reveal = count != 0;
    this._builder.get_object('achievement-counter-revealer').reveal_child = reveal;

    if (reveal) {
      this._builder.get_object('achievement-counter').label = count.toString();
    }
  }

  // This will hide the achievement with the given ID in the completed-list and reveal it
  // in the active-list. It will also reorder the list of active achievements according to
  // their progress.
  _achievementUnlocked(id) {
    this._activeAchievements[id].revealer.reveal_child    = true;
    this._completedAchievements[id].revealer.reveal_child = false;

    this._reorderActiveAchievements();
  }

  // This will reveal the achievement with the given ID in the completed-list and hide it
  // in the active-list. It will also reorder the completed-list to make the newly
  // completed achievement the first in the list.
  _achievementCompleted(id) {
    this._activeAchievements[id].revealer.reveal_child    = false;
    this._completedAchievements[id].revealer.reveal_child = true;

    // The date is actually stored in the 'stats-achievement-dates' settings key but as
    // this is updated asynchronously it will not yet be available on our end. So we
    // assume that it was just unlocked and use the current date. Once the preferences
    // dialog is opened next time, the date from 'stats-achievement-dates' will be used.
    const newDate                                   = new Date();
    this._completedAchievements[id].date            = newDate;
    this._completedAchievements[id].dateLabel.label = newDate.toLocaleString();

    this._reorderCompletedAchievements();
  }

  // This will hide the achievement with the given ID in both lists.
  _achievementLocked(id) {
    this._activeAchievements[id].revealer.reveal_child    = false;
    this._completedAchievements[id].revealer.reveal_child = false;
  }

  // This sorts the active achievements according to their progress. If two achievements
  // have the same progress, they will be sorted by name.
  _reorderActiveAchievements() {
    const container = this._builder.get_object('active-achievements-box');
    const widgets   = Object.values(this._activeAchievements);
    widgets.sort((a, b) => b.progress - a.progress || a.name.localeCompare(b.name));

    for (let i = 1; i < widgets.length; i++) {
      if (utils.gtk4()) {
        container.reorder_child_after(widgets[i].revealer, widgets[i - 1].revealer);
      } else {
        container.reorder_child(widgets[i].revealer, i);
      }
    }
  }

  // This sorts the completed achievements according to their completion date. If two
  // achievements have the same date, they will be sorted by name.
  _reorderCompletedAchievements() {
    const container = this._builder.get_object('completed-achievements-box');
    const widgets   = Object.values(this._completedAchievements);
    widgets.sort((a, b) => b.date - a.date || a.name.localeCompare(b.name));

    for (let i = 1; i < widgets.length; i++) {
      if (utils.gtk4()) {
        container.reorder_child_after(widgets[i].revealer, widgets[i - 1].revealer);
      } else {
        container.reorder_child(widgets[i].revealer, i);
      }
    }
  }

  // This adds an achievement as given by Achievements.getAchievements() to both lists,
  // the active and completed achievements. If the achievement is currently active or
  // completed, it will also be shown, else it's hidden.
  _add(achievement, id) {

    // Create the entry for the active-achievements list.
    const active                 = this._createAchievementWidget(achievement, id, false);
    this._activeAchievements[id] = active;
    if (achievement.state == Achievements.State.ACTIVE) {
      active.revealer.reveal_child = true;
    }

    // Create the entry for the completed-achievements list.
    const completed = this._createAchievementWidget(achievement, id, true);
    this._completedAchievements[id] = completed;
    if (achievement.state == Achievements.State.COMPLETED) {
      completed.revealer.reveal_child = true;
    }

    // Add them to the UI.
    utils.boxAppend(this._builder.get_object('active-achievements-box'), active.revealer);
    utils.boxAppend(
        this._builder.get_object('completed-achievements-box'), completed.revealer);
  }

  // This method creates a set of widgets contained in a Gtk.Revealer to represent an
  // achievement in the preferences dialog. If completed == false, a progress bar will be
  // included, else the completion date is shown. The returned object contains several
  // pointers to the included widgets, you may have a look at the documentation of
  // this._activeAchievements and this._completedAchievements in the constructor above.
  _createAchievementWidget(achievement, id, completed) {

    // This we will return later. Depending on completed == true, it will contain
    // different properties.
    const result = {};

    // The grid below is the main container. Depending on completed == true, it will have
    // a slightly different layout. If completed == false, it looks like the upper image,
    // if completed == true, it looks like the lower image:
    //    ___________________________________
    //   |      |_Name___________|__________|
    //   | Icon |_Description____|_______XP_|
    //   |______|_Progress_Bar___|_Progress_|
    //
    //    ___________________________________
    //   | Icon |_Name___________|_____Date_|
    //   |______|_Description____|_______XP_|
    //
    const grid = new Gtk.Grid({margin_bottom: completed ? 0 : 8});

    // Add the icon.
    const icon = new Gtk.DrawingArea({margin_end: 8});
    icon.set_size_request(64, 64);
    utils.setDrawFunc(icon, (w, ctx) => {
      Achievements.Achievements.paintAchievementIcon(ctx, achievement);
      return false;
    });

    grid.attach(icon, 0, 0, 1, 3);

    // Add the name label.
    result.name     = achievement.name;
    const nameLabel = new Gtk.Label({
      label: achievement.name,
      wrap: true,
      xalign: 0,
      max_width_chars: 0,
      hexpand: true,
      valign: Gtk.Align.END
    });
    nameLabel.get_style_context().add_class('title-4');
    grid.attach(nameLabel, 1, 0, 1, 1);

    // Add the description label.
    const description = new Gtk.Label({
      label: achievement.description,
      wrap: true,
      xalign: 0,
      max_width_chars: 0,
      valign: Gtk.Align.START
    });
    grid.attach(description, 1, 1, 1, 1);

    // Add the XP label.
    const xp = new Gtk.Label({
      label: achievement.xp + ' XP',
      xalign: 1,
      valign: completed ? Gtk.Align.START : Gtk.Align.END
    });
    xp.get_style_context().add_class('dim-label');
    xp.get_style_context().add_class('caption');
    grid.attach(xp, 2, 1, 1, 1);

    // Add the date label if completed, else the progress bar.
    if (completed) {

      result.date = new Date();
      let label   = '';

      if (achievement.state == Achievements.State.COMPLETED) {
        const dates = this._settings.get_value('stats-achievement-dates').deep_unpack();
        if (dates.hasOwnProperty(id)) {
          result.date = new Date(dates[id]);
        }
        label = result.date.toLocaleString();
      }

      result.dateLabel = new Gtk.Label(
          {label: label, xalign: 1, width_request: 90, valign: Gtk.Align.END});
      result.dateLabel.get_style_context().add_class('dim-label');
      result.dateLabel.get_style_context().add_class('caption');
      grid.attach(result.dateLabel, 2, 0, 1, 1);

    } else {

      result.progress      = achievement.progress / achievement.range[1];
      result.progressLabel = new Gtk.Label({
        label: achievement.progress + ' / ' + achievement.range[1],
        xalign: 1,
        width_request: 90
      });
      result.progressLabel.get_style_context().add_class('dim-label');
      result.progressLabel.get_style_context().add_class('caption');
      grid.attach(result.progressLabel, 2, 2, 1, 1);

      result.progressBar = new Gtk.LevelBar({
        min_value: 0,
        max_value: achievement.range[1],
        value: achievement.progress,
        valign: Gtk.Align.CENTER
      });
      result.progressBar.remove_offset_value('low');
      result.progressBar.remove_offset_value('high');
      result.progressBar.remove_offset_value('full');
      result.progressBar.remove_offset_value('empty');
      grid.attach(result.progressBar, 1, 2, 1, 1);
    }

    // Finally wrap the thing in a Gtk.Revealer.
    result.revealer = new Gtk.Revealer();
    utils.setChild(result.revealer, grid);

    return result;
  }
}