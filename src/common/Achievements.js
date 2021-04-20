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
  addSelection(depth, time, gestureOnlySelection) {
    this._addOneTo('stats-selections');

    if (depth <= 4) {
      if (gestureOnlySelection) {
        this._addOneTo(`stats-gesture-selections-depth${depth}`);
      } else {
        this._addOneTo(`stats-click-selections-depth${depth}`);
      }
    }

    if (depth == 1) {
      if (time <= 150) this._addOneTo('stats-selections-150ms-depth1');
      if (time <= 250) this._addOneTo('stats-selections-250ms-depth1');
      if (time <= 500) this._addOneTo('stats-selections-500ms-depth1');
      if (time <= 750) this._addOneTo('stats-selections-750ms-depth1');
      if (time <= 1000) this._addOneTo('stats-selections-1000ms-depth1');
    } else if (depth == 2) {
      if (time <= 250) this._addOneTo('stats-selections-250ms-depth2');
      if (time <= 500) this._addOneTo('stats-selections-500ms-depth2');
      if (time <= 750) this._addOneTo('stats-selections-750ms-depth2');
      if (time <= 1000) this._addOneTo('stats-selections-1000ms-depth2');
      if (time <= 2000) this._addOneTo('stats-selections-2000ms-depth2');
    } else if (depth == 3) {
      if (time <= 500) this._addOneTo('stats-selections-500ms-depth3');
      if (time <= 750) this._addOneTo('stats-selections-750ms-depth3');
      if (time <= 1000) this._addOneTo('stats-selections-1000ms-depth3');
      if (time <= 2000) this._addOneTo('stats-selections-2000ms-depth3');
      if (time <= 3000) this._addOneTo('stats-selections-3000ms-depth3');
    } else if (depth == 4) {
      if (time <= 750) this._addOneTo('stats-selections-750ms-depth4');
      if (time <= 1000) this._addOneTo('stats-selections-1000ms-depth4');
      if (time <= 2000) this._addOneTo('stats-selections-2000ms-depth4');
      if (time <= 3000) this._addOneTo('stats-selections-3000ms-depth4');
      if (time <= 4000) this._addOneTo('stats-selections-4000ms-depth4');
    }
  }

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

  // Should be called when all menus have been deleted.
  addDeletedAllMenus() {
    this._addOneTo('stats-deleted-all-menus');
  }

  // Should be called whenever the tutorial menu is opened.
  addTutorialMenuOpened() {
    this._addOneTo('stats-tutorial-menus');
  }

  // Should be called whenever an item is added in the menu editor.
  addItemCreated() {
    this._addOneTo('stats-added-items');
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
        // passed string is the key of the achievement in the getAchievements() map of
        // this; the second and third paramter are the new progress and maximum progress.
        'achievement-progress-changed': {param_types: [GObject.TYPE_STRING, GObject.TYPE_INT, GObject.TYPE_INT]},

        // This is called whenever an achievement is completed. The passed string is the
        // key of the completed achievement in the getAchievements() map of this.
        'achievement-completed': {param_types: [GObject.TYPE_STRING]},

        // This is called whenever a new achievement becomes available. The passed string
        // is the key of the completed achievement in the getAchievements() map of this.
        'achievement-unlocked': {param_types: [GObject.TYPE_STRING]},

        // This is called whenever an active achievement becomes unavailable. This is
        // quite unlikely but may happen when the user resets the statistics. The passed
        // string is the key of the completed achievement in the getAchievements() map of
        // this.
        'achievement-locked': {param_types: [GObject.TYPE_STRING]},
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

        this._levelXPs = [75, 100, 150, 250, 400, 800, 1200, 2000, 5000, Infinity];

        this._achievements = this._createAchievements();

        this._achievements.forEach((achievement, id) => {
          const update = (initialUpdate, achievement, id) => {
            let val = this._settings.get_uint(achievement.statsKey);

            if (achievement.statsKey == 'stats-best-tutorial-time') {
              if (val <= 500) {
                val = 6;
              } else if (val <= 750) {
                val = 5;
              } else if (val <= 1000) {
                val = 4;
              } else if (val <= 2000) {
                val = 2;
              } else if (val <= 3000) {
                val = 1;
              } else {
                val = 0;
              }
            } else if (achievement.statsKey == 'stats-dbus-menus') {
              val -= this._settings.get_uint('stats-tutorial-menus');
            }

            let newState = AchievementState.ACTIVE;

            if (val >= achievement.range[1]) {
              newState = AchievementState.COMPLETED;
            } else if (val < achievement.range[0] || achievement.hidden) {
              newState = AchievementState.LOCKED;
            }

            if (newState != achievement.state) {
              const emitSignals = achievement.state != undefined;
              achievement.state = newState;

              const key   = 'stats-achievement-dates';
              const dates = this._settings.get_value(key).deep_unpack();
              if (newState == AchievementState.COMPLETED) {
                if (!dates.hasOwnProperty(id)) {
                  dates[id] = Date.now();
                  this._settings.set_value(key, new GLib.Variant('a{sx}', dates));
                }

                if (achievement.reveals && this._achievements.has(achievement.reveals)) {
                  const revealedAchievement = this._achievements.get(achievement.reveals);
                  revealedAchievement.hidden = false;
                  update(initialUpdate, revealedAchievement, achievement.reveals);
                }

              } else {
                if (dates.hasOwnProperty(id)) {
                  delete dates[id];
                  this._settings.set_value(key, new GLib.Variant('a{sx}', dates));
                }

                if (achievement.reveals && this._achievements.has(achievement.reveals)) {
                  const revealedAchievement = this._achievements.get(achievement.reveals);
                  revealedAchievement.hidden = true;
                  update(initialUpdate, revealedAchievement, achievement.reveals);
                }
              }

              if (emitSignals && !initialUpdate) {
                if (newState == AchievementState.ACTIVE) {
                  this.emit('achievement-unlocked', id);
                } else if (newState == AchievementState.COMPLETED) {
                  this.emit('achievement-completed', id);
                } else {
                  this.emit('achievement-locked', id);
                }
              }
            }


            const newProgress =
                Math.min(Math.max(val, achievement.range[0]), achievement.range[1]);

            if (newProgress != achievement.progress) {
              const emitSignals = achievement.progress != undefined;

              achievement.progress = newProgress;

              if (emitSignals && !initialUpdate) {
                this.emit(
                    'achievement-progress-changed', id, newProgress,
                    achievement.range[1]);
              }
            }

            this._updateExperience();
          };

          this._settingsConnections.push(this._settings.connect(
              'changed::' + achievement.statsKey, () => update(false, achievement, id)));

          update(true, achievement, id);
        });
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

        let level   = 1;
        let levelXP = this._levelXPs[0];
        while (this._totalXP >= levelXP && level < this._levelXPs.length) {
          levelXP += this._levelXPs[level];
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

      _createAchievements() {

        const tiers = [_('I'), _('II'), _('III'), _('IV'), _('V')];
        const bgImages =
            ['copper.png', 'bronze.png', 'silver.png', 'gold.png', 'platinum.png'];
        const baseXP     = [10, 25, 50, 100, 250];
        const baseRanges = [0, 50, 150, 500, 1500, 5000];

        const achievements = new Map();


        for (let i = 0; i < 5; i++) {
          achievements.set('cancellor' + i, {
            name: _('Cancellor %s').replace('%s', tiers[i]),
            description:
                _('Abort a selection %i times.').replace('%i', baseRanges[i + 1]),
            bgImage: bgImages[i],
            fgImage: 'depth1.svg',
            statsKey: 'stats-abortions',
            xp: baseXP[i],
            range: [baseRanges[i], baseRanges[i + 1]],
            hidden: false
          });
        }


        for (let i = 0; i < 5; i++) {
          achievements.set('master' + i, {
            name: _('Master Pielot %s').replace('%s', tiers[i]),
            description: _('Select %i items.').replace('%i', baseRanges[i + 1] * 10),
            bgImage: bgImages[i],
            fgImage: 'depth1.svg',
            statsKey: 'stats-selections',
            xp: baseXP[i],
            range: [baseRanges[i] * 10, baseRanges[i + 1] * 10],
            hidden: false
          });
        }

        for (let depth = 1; depth <= 4; depth++) {

          let names = [
            _('Swing-Pie Selector %s / 1'), _('Swing-Pie Selector %s / 2'),
            _('Swing-Pie Selector %s / 3'), _('Swing-Pie Selector %s / 4')
          ];

          for (let i = 0; i < 5; i++) {
            achievements.set(`depth${depth}-gesture-selector${i}`, {
              name: names[depth - 1].replace('%s', tiers[i]),
              description: _('Select %i items at depth %j in marking mode.')
                               .replace('%i', baseRanges[i + 1])
                               .replace('%j', depth),
              bgImage: bgImages[i],
              fgImage: 'depth1.svg',
              statsKey: `stats-gesture-selections-depth${depth}`,
              xp: baseXP[i],
              range: [baseRanges[i], baseRanges[i + 1]],
              hidden: false
            });
          }

          names = [
            _('Bumpie Selector %s / 1'), _('Bumpie Selector %s / 2'),
            _('Bumpie Selector %s / 3'), _('Bumpie Selector %s / 4')
          ];

          for (let i = 0; i < 5; i++) {
            achievements.set(`depth${depth}-click-selector${i}`, {
              name: names[depth - 1].replace('%s', tiers[i]),
              description: _('Select %i items at depth %j with mouse clicks.')
                               .replace('%i', baseRanges[i + 1])
                               .replace('%j', depth),
              bgImage: bgImages[i],
              fgImage: 'depth1.svg',
              statsKey: `stats-click-selections-depth${depth}`,
              xp: baseXP[i],
              range: [baseRanges[i], baseRanges[i + 1]],
              hidden: false
            });
          }
        }

        {
          const timeLimits = [
            [1000, 750, 500, 250, 150],
            [2000, 1000, 750, 500, 250],
            [3000, 2000, 1000, 750, 500],
            [4000, 3000, 2000, 1000, 750],
          ];

          const names = [
            _('Snappie Selector %s / 1'), _('Snappie Selector %s / 2'),
            _('Snappie Selector %s / 3'), _('Snappie Selector %s / 4')
          ];

          const counts = [25, 50, 100, 250, 500];

          for (let depth = 1; depth <= 4; depth++) {
            for (let i = 0; i < 5; i++) {

              achievements.set(`depth${depth}-selector${i}`, {
                name: names[depth - 1].replace('%s', tiers[i]),
                description:
                    _('Select %i items at depth %j in less than %t milliseconds.')
                        .replace('%i', counts[i])
                        .replace('%t', timeLimits[depth - 1][i])
                        .replace('%j', depth),
                bgImage: bgImages[i],
                fgImage: `depth${depth}.svg`,
                statsKey: `stats-selections-${timeLimits[depth - 1][i]}ms-depth${depth}`,
                xp: baseXP[i],
                range: [0, counts[i]],
                hidden: i > 0,
                reveals: i < 5 ? `depth${depth}-selector${i + 1}` : null
              });
            }
          }
        }


        for (let i = 0; i < 5; i++) {
          achievements.set('journey' + i, {
            name: _('The Journey is the Reward %s').replace('%s', tiers[i]),
            description: _('Open the settings dialog %i times.')
                             .replace('%i', baseRanges[i + 1] / 2),
            bgImage: bgImages[i],
            fgImage: 'depth1.svg',
            statsKey: 'stats-settings-opened',
            xp: baseXP[i],
            range: [baseRanges[i] / 2, baseRanges[i + 1] / 2],
            hidden: false
          });
        }

        for (let i = 0; i < 5; i++) {
          achievements.set('nerd' + i, {
            name: _('Nerd Alert %s').replace('%s', tiers[i]),
            description: _('Open %i menus with the D-Bus interface.')
                             .replace('%i', baseRanges[i + 1]),
            bgImage: bgImages[i],
            fgImage: 'depth1.svg',
            statsKey: 'stats-dbus-menus',
            xp: baseXP[i],
            range: [baseRanges[i], baseRanges[i + 1]],
            hidden: false
          });
        }


        for (let i = 0; i < 5; i++) {
          achievements.set('entropie' + i, {
            name: _('Entropie %s').replace('%s', tiers[i]),
            description:
                _('Generate %i random presets.').replace('%i', baseRanges[i + 1]),
            bgImage: bgImages[i],
            fgImage: 'depth1.svg',
            statsKey: 'stats-random-presets',
            xp: baseXP[i],
            range: [baseRanges[i], baseRanges[i + 1]],
            hidden: false
          });
        }


        for (let i = 0; i < 5; i++) {
          achievements.set('customizer' + i, {
            name: _('Eye Candy %s').replace('%s', tiers[i]),
            description: baseRanges[i + 1] / 10 == 1 ?
                _('Save a custom preset.') :
                _('Save %i custom presets.').replace('%i', baseRanges[i + 1] / 10),
            bgImage: bgImages[i],
            fgImage: 'depth1.svg',
            statsKey: 'stats-presets-saved',
            xp: baseXP[i],
            range: [baseRanges[i] / 10, baseRanges[i + 1] / 10],
            hidden: false
          });
        }


        for (let i = 0; i < 5; i++) {
          achievements.set('importer' + i, {
            name: _('Importer %s').replace('%s', tiers[i]),
            description: baseRanges[i + 1] / 10 == 1 ?
                _('Import a menu configuration.') :
                _('Import %i menu configurations.').replace('%i', baseRanges[i + 1] / 10),
            bgImage: bgImages[i],
            fgImage: 'depth1.svg',
            statsKey: 'stats-menus-imported',
            xp: baseXP[i],
            range: [baseRanges[i] / 10, baseRanges[i + 1] / 10],
            hidden: false
          });
        }


        for (let i = 0; i < 5; i++) {
          achievements.set('exporter' + i, {
            name: _('Exporter %s').replace('%s', tiers[i]),
            description: baseRanges[i + 1] / 10 == 1 ?
                _('Export a menu configuration.') :
                _('Export %i menu configurations.').replace('%i', baseRanges[i + 1] / 10),
            bgImage: bgImages[i],
            fgImage: 'depth1.svg',
            statsKey: 'stats-menus-exported',
            xp: baseXP[i],
            range: [baseRanges[i] / 10, baseRanges[i + 1] / 10],
            hidden: false
          });
        }


        for (let i = 0; i < 5; i++) {
          achievements.set('bigmenus' + i, {
            name: _('There should be no more than twelve items...? %s')
                      .replace('%s', tiers[i]),
            description: _('Create %i items in the menu editor.')
                             .replace('%i', baseRanges[i + 1] / 5),
            bgImage: bgImages[i],
            fgImage: 'depth1.svg',
            statsKey: 'stats-added-items',
            xp: baseXP[i],
            range: [baseRanges[i] / 5, baseRanges[i + 1] / 5],
            hidden: false
          });
        }

        achievements.set('rookie', {
          name: _('Grumpie Rookie'),
          description: _('Open the tutorial menu %i times.').replace('%i', 50),
          bgImage: 'special.png',
          fgImage: 'depth1.svg',
          statsKey: 'stats-tutorial-menus',
          xp: 25,
          range: [0, 50],
          hidden: false
        });

        achievements.set('bachelor', {
          name: _('Bachelor Pielot'),
          description: _('Get all medals of the tutorial.'),
          bgImage: 'special.png',
          fgImage: 'depth1.svg',
          statsKey: 'stats-best-tutorial-time',
          xp: 50,
          range: [0, 6],
          hidden: false
        });

        achievements.set('goodpie', {
          name: _('Say Good-Pie!'),
          description: _('Delete all of your menus.'),
          bgImage: 'special.png',
          fgImage: 'depth1.svg',
          statsKey: 'stats-deleted-all-menus',
          xp: 100,
          range: [0, 1],
          hidden: true
        });



        return achievements;
      }
    });