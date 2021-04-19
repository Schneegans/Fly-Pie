//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const {GLib, Gio, GObject} = imports.gi;

const _ = imports.gettext.domain('flypie').gettext;

const Me    = imports.misc.extensionUtils.getCurrentExtension();
const utils = Me.imports.src.common.utils;

//////////////////////////////////////////////////////////////////////////////////////////
// The static Statistics class is used to record some statistics of Fly-Pie which are   //
// the basis for the achievements. The achievements can be seen in Fly-Pie's settings   //
// dialog. The statistics are stored in the stats-* keys of Fly-Pie's Gio.Settings.     //
//////////////////////////////////////////////////////////////////////////////////////////

// This class is supposed to be used as singleton in order to prevent frequent
// constructions and deconstructions of the contained Gio.Settings object. This global
// variable stores the singleton instance.
let _instance = null;

var Statistics = class Statistics {

  // ---------------------------------------------------------------------- static methods

  // Create the singleton instance lazily.
  static getInstance() {
    if (_instance == null) {
      _instance = new Statistics();
    }

    return _instance;
  }

  // This should be called when the Fly-Pie extension is disabled or the preferences
  // dialog is closed. It deletes the Gio.Settings object.
  static destroyInstance() {
    if (_instance != null) {
      _instance.destroy();
      _instance = null;
    }
  }
  // ------------------------------------------------------------ constructor / destructor

  // This should not be called directly. Use the static singleton interface above!
  constructor() {

    // Create the settings object in "delayed" mode. Delayed mode was chosen because the
    // apply() can take up to 100~ms on some systems I have tested. This results in a
    // noticeable stutter in Fly-Pie's animations. Applying the seconds with one second
    // delay makes it much more unlikely that an animation is currently in progress.
    this._settings = utils.createSettings();
    this._settings.delay();

    // As the settings object is in delay-mode, we have to call its apply() method after
    // we did some modification. We use a timeout in order to wait a little for any
    // additional modifications.
    this._saveTimeout = -1;
  }


  // This should not be called directly. Use the static singleton interface above!
  destroy() {

    // Save the settings if required.
    if (this._saveTimeout >= 0) {
      GLib.source_remove(this._saveTimeout);
      this._settings.apply();
    }

    this._settings = null;
  }

  // -------------------------------------------------------------------- public interface

  // This should be called whenever a successful selection is made.
  addSelection(depth, time, gestureOnlySelection) {}

  // Should be called whenever a selection is canceled.
  addAbortion() {
    this._addOneTo('stats-abortions');
  }

  // Should be called whenever a custom menu is opened via the D-Bus interface.
  addCustomDBusMenu() {
    this._addOneTo('stats-dbus-menus');
  }

  // Should be called whenever the settings dialog is opened.
  addSettingsOpened() {
    this._addOneTo('stats-settings-opened');
  }

  // Should be called whenever a preset is saved.
  addPresetSaved() {
    this._addOneTo('stats-presets-saved');
  }

  // Should be called whenever a menu configuration is imported.
  addMenuImport() {
    this._addOneTo('stats-menus-imported');
  }

  // Should be called whenever a menu configuration is exported.
  addMenuExport() {
    this._addOneTo('stats-menus-exported');
  }

  // Should be called whenever a random preset is generated.
  addRandomPreset() {
    this._addOneTo('stats-random-presets');
  }

  // ----------------------------------------------------------------------- private stuff

  // Our Gio.Settings object is in "delayed" mode so we have to manually call apply()
  // whenever a property is changed. Delayed mode was chosen because the apply() can take
  // up to 100~ms on some systems I have tested. This results in a noticeable stutter in
  // Fly-Pie's animations. Applying the settings with one second delay makes it much more
  // unlikely that an animation is currently in progress.
  _save() {
    if (this._saveTimeout >= 0) {
      GLib.source_remove(this._saveTimeout);
    }

    this._saveTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
      this._settings.apply();
      this._saveTimeout = -1;
    });
  }

  // Increases the value of the given settings key by one.
  _addOneTo(key) {
    this._settings.set_uint(key, this._settings.get_uint(key) + 1);
    this._save();
  }
}



//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////


var AchievementState = {LOCKED: 0, ACTIVE: 1, COMPLETED: 2};

//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////

// clang-format off
var AchievementTracker = GObject.registerClass(

    {
      Properties: {},
      Signals: {
        // This is called whenever the users levels up. The paramter provides the new
        // level.
        'level-up': {param_types: [GObject.TYPE_INT]},

        // This is usually called whenever an achievement is completed. The first
        // parameter contains the current experience points; the second contains the total
        // experience points required to level up.
        'experience-changed': {param_types: [GObject.TYPE_INT, GObject.TYPE_INT]},

        // This is called whenever the progress of an active achievement changes. The
        // passed ID is the index of the achievement in the getAchievements() list of
        // this.
        'achievement-progress-changed': {param_types: [GObject.TYPE_INT]},

        // This is called whenever an achievement is completed. The passed ID is the index
        // of the completed achievement in the getAchievements() list of this.
        'achievement-completed': {param_types: [GObject.TYPE_INT]},

        // This is called whenever a new achievement becomes available. The passed ID is
        // the index of the completed achievement in the getAchievements() list of this.
        'achievement-unlocked': {param_types: [GObject.TYPE_INT]},
      }
    },

    class AchievementTracker extends GObject.Object {
      // clang-format on
      // -------------------------------------------------------- constructor / destructor

      _init(settings) {
        super._init();

        // Keep a reference to the settings.
        this._settings = settings;

        // We keep several connections to the Gio.Settings object. Once the settings
        // dialog is closed, we use this array to disconnect all of them.
        this._settingsConnections = [];

        this._totalXP = 0;

        this._levelXPs = [100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, Infinity];

        this._achievements = [
          {
            name: _('Cancellor I'),
            description: _('Cancel the selection %i times.').replace('%i', 10),
            bgImage: 'copper.png',
            fgImage: 'a.svg',
            statsKey: 'stats-abortions',
            xp: 10,
            range: [0, 10]
          },
          {
            name: _('Cancellor II'),
            description: _('Cancel the selection %i times.').replace('%i', 50),
            bgImage: 'bronze.png',
            fgImage: 'b.svg',
            statsKey: 'stats-abortions',
            xp: 25,
            range: [10, 50]
          },
          {
            name: _('Cancellor III'),
            description: _('Cancel the selection %i times.').replace('%i', 250),
            bgImage: 'silver.png',
            fgImage: 'c.svg',
            statsKey: 'stats-abortions',
            xp: 50,
            range: [50, 250]
          },
          {
            name: _('Cancellor IV'),
            description: _('Cancel the selection %i times.').replace('%i', 1000),
            bgImage: 'gold.png',
            fgImage: 'd.svg',
            statsKey: 'stats-abortions',
            xp: 100,
            range: [250, 1000]
          },
          {
            name: _('Cancellor V'),
            description: _('Cancel the selection %i times.').replace('%i', 5000),
            bgImage: 'platinum.png',
            fgImage: 'e.svg',
            statsKey: 'stats-abortions',
            xp: 250,
            range: [1000, 5000]
          }
        ];

        for (let i = 0; i < this._achievements.length; i++) {
          const achievement = this._achievements[i];

          const update = () => {
            const val = this._settings.get_uint(achievement.statsKey);

            var newState = AchievementState.ACTIVE;

            if (val < achievement.range[0]) {
              newState = AchievementState.LOCKED;
            } else if (val >= achievement.range[1]) {
              newState = AchievementState.COMPLETED;
            }

            if (newState != achievement.state) {
              const emitSignals = achievement.state != undefined;
              achievement.state = newState;
              if (emitSignals) {
                if (newState == AchievementState.ACTIVE) {
                  this.emit('achievement-unlocked', i);
                } else if (newState == AchievementState.COMPLETED) {
                  this.emit('achievement-completed', i);
                }
              }
            }


            const newProgress =
                Math.min(Math.max(val, achievement.range[0]), achievement.range[1]);

            if (newProgress != achievement.progress) {
              const emitSignals = achievement.progress != undefined;

              achievement.progress = newProgress;

              if (emitSignals) {
                this.emit('achievement-progress-changed', i);
              }
            }

            this._updateExperience();
          };

          this._settingsConnections.push(
              this._settings.connect('changed::' + achievement.statsKey, update));

          update();
        }
      }

      // This should be called when the settings dialog is closed. It disconnects handlers
      // registered with the Gio.Settings objects.
      destroy() {
        this._settingsConnections.forEach(connection => {
          this._settings.disconnect(connection);
        });
      }

      getAchievements() {
        return this._achievements;
      }

      getCurrentLevel() {
        return this._currentLevel;
      }

      getLevelXP() {
        let levelXP = this._totalXP;
        for (let i = 0; i < this._currentLevel - 1; i++) {
          levelXP -= this._levelXPs[i];
        }

        return levelXP;
      }

      getLevelMaxXP() {
        return this._levelXPs[this._currentLevel - 1];
      }

      _updateExperience() {
        let totalXP         = 0;
        let emitXPChange    = false;
        let emitLevelChange = false;

        this._achievements.forEach(achievement => {
          if (achievement.state == AchievementState.COMPLETED) {
            totalXP += achievement.xp;
          }
        });

        if (totalXP != this._totalXP) {
          this._totalXP = totalXP;
          emitXPChange  = true;
        }

        let level = 1;
        while (this._totalXP >= this._levelXPs[level - 1] &&
               level < this._levelXPs.length) {
          ++level;
        }

        if (level != this._currentLevel) {
          this._currentLevel = level;
          emitLevelChange    = true;
        }

        if (emitXPChange) {
          this.emit('experience-changed', this.getLevelXP(), this.getLevelMaxXP());
        }

        if (emitLevelChange) {
          this.emit('level-up', this._currentLevel);
        }
      }
    });