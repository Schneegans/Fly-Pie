//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const {GLib, GObject} = imports.gi;

const _ = imports.gettext.domain('flypie').gettext;

const Me    = imports.misc.extensionUtils.getCurrentExtension();
const utils = Me.imports.src.common.utils;

var State = {LOCKED: 0, ACTIVE: 1, COMPLETED: 2};

//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////

// clang-format off
var Achievements = GObject.registerClass(

    {
      Properties: {},
      Signals: {
        // This is called whenever the users levels up. The paramter provides the new
        // level.
        'level-changed': {param_types: [GObject.TYPE_INT]},

        // This is usually called whenever an achievement is completed. The first
        // parameter contains the current experience points; the second contains the total
        // experience points required to level up.
        'experience-changed': {param_types: [GObject.TYPE_INT, GObject.TYPE_INT]},

        // This is called whenever the progress of an active achievement changes. The
        // passed string is the key of the achievement in the getAchievements() map of
        // this; the second and third paramter are the new progress and maximum progress.
        'progress-changed': {param_types: [GObject.TYPE_STRING, GObject.TYPE_INT, GObject.TYPE_INT]},

        // This is called whenever an achievement is completed. The passed string is the
        // key of the completed achievement in the getAchievements() map of this.
        'completed': {param_types: [GObject.TYPE_STRING]},

        // This is called whenever a new achievement becomes available. The passed string
        // is the key of the completed achievement in the getAchievements() map of this.
        'unlocked': {param_types: [GObject.TYPE_STRING]},

        // This is called whenever an active achievement becomes unavailable. This is
        // quite unlikely but may happen when the user resets the statistics. The passed
        // string is the key of the completed achievement in the getAchievements() map of
        // this.
        'locked': {param_types: [GObject.TYPE_STRING]},
      }
    },

    class Achievements extends GObject.Object {
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

        this._levelXPs = [500, 750, 1000, 1500, 2000, 3500, 5000, 7500, 10000, Infinity];

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

            let newState = State.ACTIVE;

            if (val >= achievement.range[1]) {
              newState = State.COMPLETED;
            } else if (val < achievement.range[0] || achievement.hidden) {
              newState = State.LOCKED;
            }

            if (newState != achievement.state) {
              const emitSignals = achievement.state != undefined;
              achievement.state = newState;

              const key   = 'stats-achievement-dates';
              const dates = this._settings.get_value(key).deep_unpack();
              if (newState == State.COMPLETED) {
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
                if (newState == State.ACTIVE) {
                  this.emit('unlocked', id);
                } else if (newState == State.COMPLETED) {
                  this.emit('completed', id);
                } else {
                  this.emit('locked', id);
                }
              }
            }


            const newProgress =
                Math.min(Math.max(val, achievement.range[0]), achievement.range[1]);

            if (newProgress != achievement.progress) {
              const emitSignals = achievement.progress != undefined;

              achievement.progress = newProgress;

              if (emitSignals && !initialUpdate) {
                this.emit('progress-changed', id, newProgress, achievement.range[1]);
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
          if (achievement.state == State.COMPLETED) {
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
          this.emit('level-changed', this._currentLevel);
        }
      }

      _createAchievements() {

        const attributes =
            [_('Novice'), _('Capable'), _('Skilled'), _('Expert'), _('Master')];
        const numbers = [_('I'), _('II'), _('III'), _('IV'), _('V')];
        const bgImages =
            ['copper.png', 'bronze.png', 'silver.png', 'gold.png', 'platinum.png'];
        const baseXP     = [100, 250, 500, 750, 1000];
        const baseRanges = [0, 10, 30, 100, 300, 1000];

        const achievements = new Map();


        for (let i = 0; i < 5; i++) {
          achievements.set('cancellor' + i, {
            name:
                _('%s Cancellor').replace('%s', attributes[i]).replace('%i', numbers[i]),
            description:
                _('Abort a selection %x times.').replace('%x', baseRanges[i + 1] * 2),
            bgImage: bgImages[i],
            fgImage: 'depth1.svg',
            statsKey: 'stats-abortions',
            xp: baseXP[i],
            range: [baseRanges[i] * 2, baseRanges[i + 1] * 2],
            hidden: false
          });
        }


        for (let i = 0; i < 5; i++) {
          achievements.set('master' + i, {
            name: _('%s Pielot').replace('%s', attributes[i]).replace('%i', numbers[i]),
            description: _('Select %x items.').replace('%x', baseRanges[i + 1] * 5),
            bgImage: bgImages[i],
            fgImage: 'depth1.svg',
            statsKey: 'stats-selections',
            xp: baseXP[i] * 2,
            range: [baseRanges[i] * 5, baseRanges[i + 1] * 5],
            hidden: false
          });
        }

        for (let depth = 1; depth <= 4; depth++) {

          let names = [
            _('%s Toplevel Gesture-Selector'), _('%s Submenu Gesture-Selector'),
            _('%s Subsubmenu Gesture-Selector'), _('%s Subsubsubmenu Gesture-Selector')
          ];

          for (let i = 0; i < 5; i++) {
            achievements.set(`depth${depth}-gesture-selector${i}`, {
              name:
                  names[depth - 1].replace('%s', attributes[i]).replace('%i', numbers[i]),
              description: _('Select %x items at depth %j in marking mode.')
                               .replace('%x', baseRanges[i + 1] * 2)
                               .replace('%j', depth),
              bgImage: bgImages[i],
              fgImage: 'depth1.svg',
              statsKey: `stats-gesture-selections-depth${depth}`,
              xp: baseXP[i],
              range: [baseRanges[i] * 2, baseRanges[i + 1] * 2],
              hidden: false
            });
          }

          names = [
            _('%s Toplevel Click-Selector'), _('%s Submenu Click-Selector'),
            _('%s Subsubmenu Click-Selector'), _('%s Subsubsubmenu Click-Selector')
          ];

          for (let i = 0; i < 5; i++) {
            achievements.set(`depth${depth}-click-selector${i}`, {
              name:
                  names[depth - 1].replace('%s', attributes[i]).replace('%i', numbers[i]),
              description: _('Select %x items at depth %j with mouse clicks.')
                               .replace('%x', baseRanges[i + 1] * 2)
                               .replace('%j', depth),
              bgImage: bgImages[i],
              fgImage: 'depth1.svg',
              statsKey: `stats-click-selections-depth${depth}`,
              xp: baseXP[i],
              range: [baseRanges[i] * 2, baseRanges[i + 1] * 2],
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
            _('%s Toplevel Selector'), _('%s Submenu Selector'),
            _('%s Subsubmenu Selector'), _('%s Subsubsubmenu Selector')
          ];

          const counts = [50, 100, 150, 200, 250];

          for (let depth = 1; depth <= 4; depth++) {
            for (let i = 0; i < 5; i++) {

              achievements.set(`depth${depth}-selector${i}`, {
                name: names[depth - 1]
                          .replace('%s', attributes[i])
                          .replace('%i', numbers[i]),
                description:
                    _('Select %x items at depth %j in less than %t milliseconds.')
                        .replace('%x', counts[i])
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
            name: _('The Journey Is The Reward %i')
                      .replace('%s', attributes[i])
                      .replace('%i', numbers[i]),
            description: _('Open the settings dialog %x times.')
                             .replace('%x', baseRanges[i + 1] / 2),
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
            name:
                _('Nerd Alert %i').replace('%s', attributes[i]).replace('%i', numbers[i]),
            description: _('Open %x menus with the D-Bus interface.')
                             .replace('%x', baseRanges[i + 1]),
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
            name: _('Entropie %i').replace('%s', attributes[i]).replace('%i', numbers[i]),
            description:
                _('Generate %x random presets.').replace('%x', baseRanges[i + 1] / 2),
            bgImage: bgImages[i],
            fgImage: 'depth1.svg',
            statsKey: 'stats-random-presets',
            xp: baseXP[i] / 2,
            range: [baseRanges[i] / 2, baseRanges[i + 1] / 2],
            hidden: false
          });
        }


        for (let i = 0; i < 5; i++) {
          achievements.set('preset-exporter' + i, {
            name: _('%s Preset Exporter')
                      .replace('%s', attributes[i])
                      .replace('%i', numbers[i]),
            description: baseRanges[i + 1] / 10 == 1 ?
                _('Export a custom preset.') :
                _('Export %x custom presets.').replace('%x', baseRanges[i + 1] / 10),
            bgImage: bgImages[i],
            fgImage: 'depth1.svg',
            statsKey: 'stats-presets-exported',
            xp: baseXP[i] / 2,
            range: [baseRanges[i] / 10, baseRanges[i + 1] / 10],
            hidden: false
          });
        }


        for (let i = 0; i < 5; i++) {
          achievements.set('preset-importer' + i, {
            name: _('%s Preset Importer')
                      .replace('%s', attributes[i])
                      .replace('%i', numbers[i]),
            description: baseRanges[i + 1] / 10 == 1 ?
                _('Import a custom preset.') :
                _('Import %x custom presets.').replace('%x', baseRanges[i + 1] / 10),
            bgImage: bgImages[i],
            fgImage: 'depth1.svg',
            statsKey: 'stats-presets-imported',
            xp: baseXP[i] / 2,
            range: [baseRanges[i] / 10, baseRanges[i + 1] / 10],
            hidden: false
          });
        }


        for (let i = 0; i < 5; i++) {
          achievements.set('menu-importer' + i, {
            name: _('%s Menu Importer')
                      .replace('%s', attributes[i])
                      .replace('%i', numbers[i]),
            description: baseRanges[i + 1] / 10 == 1 ?
                _('Import a menu configuration.') :
                _('Import %x menu configurations.').replace('%x', baseRanges[i + 1] / 10),
            bgImage: bgImages[i],
            fgImage: 'depth1.svg',
            statsKey: 'stats-menus-imported',
            xp: baseXP[i] / 2,
            range: [baseRanges[i] / 10, baseRanges[i + 1] / 10],
            hidden: false
          });
        }


        for (let i = 0; i < 5; i++) {
          achievements.set('menu-exporter' + i, {
            name: _('%s Menu Exporter')
                      .replace('%s', attributes[i])
                      .replace('%i', numbers[i]),
            description: baseRanges[i + 1] / 10 == 1 ?
                _('Export a menu configuration.') :
                _('Export %x menu configurations.').replace('%x', baseRanges[i + 1] / 10),
            bgImage: bgImages[i],
            fgImage: 'depth1.svg',
            statsKey: 'stats-menus-exported',
            xp: baseXP[i] / 2,
            range: [baseRanges[i] / 10, baseRanges[i + 1] / 10],
            hidden: false
          });
        }


        for (let i = 0; i < 5; i++) {
          achievements.set('bigmenus' + i, {
            name: _('There Should Be No More Than Twelve Items...? %i')
                      .replace('%s', attributes[i])
                      .replace('%i', numbers[i]),
            description: _('Create %x items in the menu editor.')
                             .replace('%x', baseRanges[i + 1] / 2),
            bgImage: bgImages[i],
            fgImage: 'depth1.svg',
            statsKey: 'stats-added-items',
            xp: baseXP[i],
            range: [baseRanges[i] / 2, baseRanges[i + 1] / 2],
            hidden: false
          });
        }

        achievements.set('rookie', {
          name: _('Grumpie Rookie'),
          description: _('Open the tutorial menu %x times.').replace('%x', 50),
          bgImage: 'special.png',
          fgImage: 'depth1.svg',
          statsKey: 'stats-tutorial-menus',
          xp: 100,
          range: [0, 50],
          hidden: false
        });

        achievements.set('bachelor', {
          name: _('Bachelor Pielot'),
          description: _('Get all medals of the tutorial.'),
          bgImage: 'special.png',
          fgImage: 'depth1.svg',
          statsKey: 'stats-best-tutorial-time',
          xp: 250,
          range: [0, 6],
          hidden: false
        });

        achievements.set('goodpie', {
          name: _('Say Good-Pie!'),
          description: _('Delete all of your menus.'),
          bgImage: 'special.png',
          fgImage: 'depth1.svg',
          statsKey: 'stats-deleted-all-menus',
          xp: 500,
          range: [0, 1],
          hidden: true
        });

        return achievements;
      }
    });