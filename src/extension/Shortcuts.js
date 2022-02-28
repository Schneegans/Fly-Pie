//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Main                            = imports.ui.main;
const {Shell, Meta, GObject, Clutter} = imports.gi;

const Config = imports.misc.config;
const Me     = imports.misc.extensionUtils.getCurrentExtension();
const utils  = Me.imports.src.common.utils;

//////////////////////////////////////////////////////////////////////////////////////////
// This class can be used to bind a function to global hot keys. It's designed in the   //
// following way: An  arbitrary number of shortcuts can be registered. If one of the    //
// shortcuts is pressed, the "activated" signal will be executed. The pressed shortcut  //
// is passed as a parameter to the callback.                                            //
// In addition, this class intercepts to the global Super+RMB event and allows          //
// executing code when this is received. This is possible as Super+RMB usually shows    //
// the window menu and we can intercept this.                                           //
//////////////////////////////////////////////////////////////////////////////////////////

var Shortcuts = GObject.registerClass(

    {
      Properties: {},
      Signals: {
        'activated': {param_types: [GObject.TYPE_STRING]},
        'super-rmb':
            {return_type: GObject.TYPE_BOOLEAN, flags: GObject.SignalFlags.RUN_LAST},
      }
    },

    class Shortcuts extends GObject.Object {
      // -------------------------------------------------------- constructor / destructor

      // Whenever one of the registered shortcuts is pressed, the "activated" callback
      // will be executed. The pressed shortcut is given as parameter.
      _init() {
        super._init();

        // All registered callbacks are stored in this map.
        this._shortcuts = new Map();

        // Listen for global shortcut activations and execute the given callback if it's
        // one of ours.
        this._displayConnection =
            global.display.connect('accelerator-activated', (display, action) => {
              for (let it of this._shortcuts) {
                if (it[1].action == action) {
                  this.emit('activated', it[0]);
                }
              }
            });

        // Intercept the Super+RMB when clicked on a window.
        this._oldShowWindowMenu = Main.wm._windowMenuManager.showWindowMenuForWindow;
        const me                = this;
        Main.wm._windowMenuManager.showWindowMenuForWindow = function(...params) {
          const mods = global.get_pointer()[2];
          if ((mods & Clutter.ModifierType.MOD4_MASK) == 0) {
            me._oldShowWindowMenu.apply(this, params);
            return;
          }

          // Execute the original handler if the signal connected handler returns false.
          const handled = me.emit('super-rmb');
          if (!handled) {
            me._oldShowWindowMenu.apply(this, params);
          }
        };

        // Intercept the Super+RMB when clicked anywhere else.
        this._stageConnection = global.stage.connect('captured-event', (a, event) => {
          if (event.type() == Clutter.EventType.BUTTON_PRESS &&
              (event.get_state() & Clutter.ModifierType.MOD4_MASK) > 0) {

            if (event.get_button() == 3) {
              if (this.emit('super-rmb')) {
                return Clutter.EVENT_STOP;
              }
            }
          }
          return Clutter.EVENT_PROPAGATE;
        });
      }

      // Unbinds all registered shortcuts.
      destroy() {
        global.display.disconnect(this._displayConnection);
        global.stage.disconnect(this._stageConnection);

        Main.wm._windowMenuManager.showWindowMenuForWindow = this._oldShowWindowMenu;

        for (let shortcut of this.getBound()) {
          this.unbind(shortcut);
        }
      }

      // ---------------------------------------------------------------- public interface

      // Binds the given shortcut. When it's pressed, the callback given to this class
      // instance at construction time will be executed.
      bind(shortcut) {

        const action =
            global.display.grab_accelerator(shortcut, Meta.KeyBindingFlags.NONE);

        if (action == Meta.KeyBindingAction.NONE) {
          utils.debug('Unable to grab shortcut ' + shortcut + '!');
        } else {
          const name = Meta.external_binding_name_for_action(action);
          Main.wm.allowKeybinding(name, Shell.ActionMode.ALL);

          this._shortcuts.set(shortcut, {name: name, action: action});
        }
      }

      // Un-binds any previously bound shortcut.
      unbind(shortcut) {
        const it = this._shortcuts.get(shortcut);

        if (it) {
          global.display.ungrab_accelerator(it.action);
          Main.wm.allowKeybinding(it.name, Shell.ActionMode.NONE);
          this._shortcuts.delete(shortcut);
        }
      }

      // Checks whether the given shortcut is currently bound by this Shortcuts instance.
      isBound(shortcut) {
        return this._shortcuts.has(shortcut);
      }

      // Returns a Set containing all shortcuts currently bound by this Shortcuts
      // instance.
      getBound() {
        return new Set(this._shortcuts.keys());
      }
    });
