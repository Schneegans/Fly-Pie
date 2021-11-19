//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Main                       = imports.ui.main;
const {Meta, Clutter, Gio, GLib} = imports.gi;

const Me            = imports.misc.extensionUtils.getCurrentExtension();
const utils         = Me.imports.src.common.utils;
const DBusInterface = Me.imports.src.common.DBusInterface.DBusInterface;
const MenuItem      = Me.imports.src.extension.MenuItem.MenuItem;

const DBusWrapper = Gio.DBusProxy.makeProxyWrapper(DBusInterface.description);

//////////////////////////////////////////////////////////////////////////////////////////
// This class maintains a list of "Touch Buttons". There can be one touch button for    //
// each configured menu. They are floating above everything and can be used to quickly  //
// open the corresponding menu.                                                         //
//////////////////////////////////////////////////////////////////////////////////////////

const DRAG_OPACITY = 100;  // Opacity (0...255) for touch buttons when being dragged.
const DRAG_SCALE   = 0.7;  // Scale factor for touch buttons when being dragged.

var TouchButtons = class TouchButtons {

  // ------------------------------------------------------------ constructor / destructor

  constructor(settings) {

    // Keep a reference to the settings.
    this._settings = settings;

    // This will contain an Clutter.Actor for each touch button.
    this._touchButtons = [];

    // This will contain a reference to the currently configured menus.
    this._configs = [];

    // We have to wait until GNOME Shell has been started so that we can add the touch
    // buttons.
    this._startupCompleteID = 0;

    // True, if GNOME Shell is currently in overview mode (as opposed to the desktop
    // mode).
    this._inOverview = false;

    // This stores a reference to the latest input device we received motion events from.
    // This device will be grabbed when we move the touch buttons around.
    this._latestInputDevice = null;

    // True, if there is currently a Fly-Pie menu opened.
    this._menuOpened = false;

    // Connect to the daemon so that we can open the menus.
    new DBusWrapper(
        Gio.DBus.session, 'org.gnome.Shell', '/org/gnome/shell/extensions/flypie',
        proxy => {
          this._dbus = proxy;

          // Make all touch buttons visible once a menu is closed again. They are hidden
          // when a menu is opened to reduce screen clutter.
          this._dbus.connectSignal('OnSelect', () => {
            this._menuOpened = false;
            this._updateVisibility(true);
          });

          this._dbus.connectSignal('OnCancel', () => {
            this._menuOpened = false;
            this._updateVisibility(true);
          });
        });

    // Keep track of the overview / desktop mode. Touch buttons can be shown or hidden in
    // the one or the other mode.
    this._shownOverviewID = Main.overview.connect('showing', () => {
      this._inOverview = true;
      this._updateVisibility(true);
    });

    // Keep track of the overview / desktop mode. Touch buttons can be shown or hidden in
    // the one or the other mode.
    this._hideOverviewID = Main.overview.connect('hiding', () => {
      this._inOverview = false;
      this._updateVisibility(true);
    });

    // Trigger an initial parsing of the settings.
    this.onSettingsChange();
  }

  // This is called by the Daemon once the extension is unloaded.
  destroy() {

    // Destroy all touch buttons.
    this._touchButtons.forEach(button => button.destroy());
    this._touchButtons = [];

    // Disconnect handlers.
    if (this._startupCompleteID) {
      Main.layoutManager.disconnect(this._startupCompleteID);
    }

    Main.overview.disconnect(this._shownOverviewID);
    Main.overview.disconnect(this._hideOverviewID);
  }

  // -------------------------------------------------------------------- public interface

  // This is called by the daemon whenever the menu configuration is changed by the user.
  setMenuConfigs(configs) {
    this._configs = configs;

    // We have to wait until GNOME Shell has been started so that we can add the touch
    // buttons.
    if (Main.layoutManager._startingUp) {
      this._startupCompleteID =
          Main.layoutManager.connect('startup-complete', () => this._createButtons());
    } else {
      this._createButtons();
    }
  }

  // This is called by the daemon whenever something changed in Fly-Pie's settings. This
  // updates the appearance of the touch buttons to look like the center item of the
  // menus.
  onSettingsChange(keys) {

    // We try to prevent to frequent updates by checking which settings keys actually
    // changed. Only if one of the following settings keys was changed, we continue
    // updating the buttons.
    if (keys) {
      const relevantKeys = [
        'global-scale',
        'center-auto-color-luminance-hover',
        'center-auto-color-opacity-hover',
        'center-auto-color-saturation-hover',
        'center-background-image-hover',
        'center-color-mode-hover',
        'center-fixed-color-hover',
        'center-icon-crop-hover',
        'center-icon-opacity-hover',
        'center-icon-scale-hover',
        'center-size-hover',
        'easing-duration',
        'font',
        'text-color',
        'touch-buttons-opacity',
        'touch-buttons-show-above-fullscreen',
        'touch-buttons-show-in-desktop-mode',
        'touch-buttons-show-in-overview-mode',
      ];

      // This fancy nested loop checks whether "keys" contains any of the relevant keys
      // above. It terminates early if one is found.
      const changedRelevantKey = keys.some(
          key => relevantKeys.some(
              relevantKey => key == GLib.quark_try_string(relevantKey)));

      if (!changedRelevantKey) {
        return;
      }
    }

    // Now we store a copy of all settings we require to draw the buttons. This makes is
    // unnecessary to query them whenever the menu configuration is changed.
    const globalScale = this._settings.get_double('global-scale');

    // clang-format off
    this._cachedSettings = {
      easingDuration:      this._settings.get_double('easing-duration') * 1000,
      textColor:           Clutter.Color.from_string(this._settings.get_string('text-color'))[1],
      font:                this._settings.get_string('font'),
      opacity:             this._settings.get_double('touch-buttons-opacity') * 255,
      showInOverview:      this._settings.get_boolean('touch-buttons-show-in-overview-mode'),
      showOnDesktop:       this._settings.get_boolean('touch-buttons-show-in-desktop-mode'),
      showAboveFullscreen: this._settings.get_boolean('touch-buttons-show-above-fullscreen'),
      size:                this._settings.get_double('center-size-hover') * globalScale,
      iconScale:           this._settings.get_double('center-icon-scale-hover'),
      iconCrop:            this._settings.get_double('center-icon-crop-hover'),
      iconOpacity:         this._settings.get_double('center-icon-opacity-hover'),
      backgroundImage:     MenuItem.loadBackgroundImage(this._settings.get_string('center-background-image-hover'),
                                                        this._settings.get_double('center-size-hover') * globalScale)
    };
    // clang-format on

    // If the color mode is 'auto', we calculate an average color of the icon.
    if (this._settings.get_string('center-color-mode-hover') == 'auto') {

      // Compute the average color on a smaller version of the icon.
      const iconName = this._settings.get_string('center-background-image-hover');
      const surface  = utils.createIcon(iconName, 24, this._cachedSettings.font, {
        red: this._cachedSettings.textColor.red / 255,
        green: this._cachedSettings.textColor.green / 255,
        blue: this._cachedSettings.textColor.blue / 255
      });

      const [r, g, b]        = utils.getAverageIconColor(surface, 24);
      const averageIconColor = new Clutter.Color({red: r, green: g, blue: b});

      // Now we modify this color based on the configured luminance and saturation values.
      const saturation = this._settings.get_double('center-auto-color-saturation-hover');
      const luminance  = this._settings.get_double('center-auto-color-luminance-hover');
      const opacity = this._settings.get_double('center-auto-color-opacity-hover') * 255;

      // Store the resulting color.
      this._cachedSettings.backgroundColor =
          MenuItem.getAutoColor(averageIconColor, luminance, saturation, opacity);

    }
    // Else we simply use the configured fixed color.
    else {
      this._cachedSettings.backgroundColor = Clutter.Color.from_string(
          this._settings.get_string('center-fixed-color-hover'))[1];
    }

    // Now (re-)create the buttons!
    this._createButtons();
  }

  // ----------------------------------------------------------------------- private stuff

  // This method (re-)creates all touch buttons.
  _createButtons() {

    // Try not to create the buttons if GNOME Shell is not fully started yet.
    if (Main.layoutManager._startingUp) {
      return;
    }

    // First remove all existing buttons.
    this._touchButtons.forEach(button => button.destroy());
    this._touchButtons = [];

    // This settings item stores the touch-button positions for all menus as simple [x, y]
    // pairs. If a menu has no touch button enabled, the position at the menu's index will
    // be an empty array [].
    const positions = this._settings.get_value('touch-button-positions').deep_unpack();

    // Loop through all menu configurations.
    this._configs.forEach((config, i) => {
      // We only have to do something if the touch button is enabled.
      if (config.touchButton) {

        // Create a Clutter.Actor which looks like the center item of a menu.
        const actor = MenuItem.createIcon(
            this._cachedSettings.backgroundColor, this._cachedSettings.backgroundImage,
            this._cachedSettings.size, config.icon, this._cachedSettings.iconScale,
            this._cachedSettings.iconCrop, this._cachedSettings.iconOpacity,
            this._cachedSettings.textColor, this._cachedSettings.font);

        // This way we can identify the actor with the looking glass tool.
        actor.name = `Fly-Pie TouchButton (${config.name})`;

        // Set the actor's size.
        actor.width  = this._cachedSettings.size;
        actor.height = this._cachedSettings.size;

        // Set the actor's position. This is either the stored position or -- if non is
        // stored -- the center of the current monitor.
        if (positions[i] && positions[i].length == 2) {
          actor.x = positions[i][0];
          actor.y = positions[i][1];
        } else {
          actor.x = Main.layoutManager.currentMonitor.x +
              (Main.layoutManager.currentMonitor.width - actor.width) / 2;
          actor.y = Main.layoutManager.currentMonitor.y +
              (Main.layoutManager.currentMonitor.height - actor.height) / 2;
        }

        actor.connect('event', (actor, event) => {
          // Update the actor's position when dragged around. We also store a reference to
          // the latest input device interacting with the touch button so that we can grab
          // it later.
          if (event.type() == Clutter.EventType.MOTION ||
              event.type() == Clutter.EventType.TOUCH_UPDATE) {

            this._latestInputDevice = event.get_device();

            if (actor._dragging) {
              const [x, y] = event.get_coords();
              actor.x      = x - actor._dragStartX;
              actor.y      = y - actor._dragStartY;
            }
            return Clutter.EVENT_STOP;
          }

          // If the pointer leaves the touch button, we make it somewhat transparent.
          if (event.type() == Clutter.EventType.LEAVE) {

            // Make sure that the long-press action gets canceled.
            actor.get_actions()[0].release();

            if (!actor._dragging && !this._menuOpened) {
              this._ease(actor, {opacity: this._cachedSettings.opacity});
            }
            return Clutter.EVENT_STOP;
          }

          // Now we have to wire up some events. If the pointer enters the touch button,
          // we make it fully opaque.
          if (event.type() == Clutter.EventType.ENTER) {
            if (!actor._dragging) {
              this._ease(actor, {opacity: 255});
            }
            return Clutter.EVENT_STOP;
          }

          // Reset the touch button state on button release / touch end events.
          if (event.type() == Clutter.EventType.BUTTON_RELEASE ||
              event.type() == Clutter.EventType.TOUCH_END) {

            // Make sure that the long-press action gets canceled.
            actor.get_actions()[0].release();

            // The button-release event is used to end a drag operation.
            if (actor._dragging) {
              actor._dragging = false;

              // Release the pointer grab.
              this._ungrab();

              // Use the normal cursor again.
              global.display.set_cursor(Meta.Cursor.DEFAULT);

              // Make the button's size and opacity "normal" again.
              this._ease(actor, {opacity: 255});
              this._ease(actor, {scale_x: 1});
              this._ease(actor, {scale_y: 1});

              // Now save the updated touch button position. We retrieve the current
              // positions list and update the entry for currently dragged item.
              const positions =
                  this._settings.get_value('touch-button-positions').deep_unpack();
              positions[i] = [actor.x, actor.y];

              // It can be possible that there are undefined entries before the current
              // one, so we set them to [].
              for (let j = 0; j < i; j++) {
                positions[j] = positions[j] || [];
              }

              // Save the updated positions.
              const variant = new GLib.Variant('aah', positions);
              this._settings.set_value('touch-button-positions', variant);
            }
            return Clutter.EVENT_STOP;
          }


          return Clutter.EVENT_CONTINUE;
        });

        // This long-press action is used to initiate dragging as well es opening the
        // menu. The latter is done whenever the long press is aborted.
        const action = Clutter.ClickAction.new();
        action.connect('long-press', (action, actor, state) => {
          // We support long presses.
          if (state == Clutter.LongPressState.QUERY) {

            // This should not be necessary. For some reason, the long-press action is
            // canceled directly after it started for touch events. With mouse input,
            // everything works without these two lines, but to get touch input working,
            // we have to grab the input here. It is released a few lines further below.
            this._grab(actor);

            return true;
          }

          // Second part of the workaround mentioned above.
          this._ungrab();

          // If the long press was executed, we initiate dragging of the actor.
          if (state == Clutter.LongPressState.ACTIVATE) {

            // First we shrink the button a bit and make it translucent. The pivot point
            // for shrinking is the pointer position inside the actor.
            let x, y, ok;
            [x, y]     = action.get_coords();
            [ok, x, y] = actor.transform_stage_point(x, y);
            actor.set_pivot_point(x / actor.width, y / actor.height);
            this._ease(actor, {opacity: DRAG_OPACITY});
            this._ease(actor, {scale_x: DRAG_SCALE});
            this._ease(actor, {scale_y: DRAG_SCALE});

            // Store some dragging state.
            actor._dragging   = true;
            actor._dragStartX = x;
            actor._dragStartY = y;

            // Grab the input so that we do not loose the actor during quick movements.
            this._grab(actor);

            // Use a dragging graphic for the cursor.
            global.display.set_cursor(Meta.Cursor.DND_IN_DRAG);

          }
          // If the long press was canceled (either due to it being to short or because
          // the pointer moved while the button was pressed), we open the menu.
          else if (state == Clutter.LongPressState.CANCEL) {

            // Show the menu directly centered above the touch button.
            this._dbus.ShowMenuAtRemote(
                config.name, actor.x + actor.width / 2, actor.y + actor.height / 2);
            this._menuOpened = true;

            // Hide all touch buttons as long as the menu is opened.
            this._updateVisibility(true);
          }
        });

        actor.add_action(action);

        // Finally, save the actor in our list.
        this._touchButtons.push(actor);
      }
    });

    // Set the initial visibility without an animation.
    this._updateVisibility(false);
  }

  // This method updates the visibility of all touch buttons. They are hidden if a menu is
  // currently shown or -- depending on the settings -- when GNOME Shell is currently in
  // overview or desktop mode.
  // The parameter controls whether the opacity should be animated.
  _updateVisibility(doEase) {
    const visible = !this._menuOpened &&
        ((this._inOverview && this._cachedSettings.showInOverview) ||
         (!this._inOverview && this._cachedSettings.showOnDesktop));

    // We have to re-add the actors the interface because the parameters passed to
    // addChrome() cannot be changed for already added actors. So we remove them and add
    // the with updated parameters.
    this._touchButtons.forEach(button => {
      if (button.get_parent()) {
        Main.layoutManager.removeChrome(button);
      }

      Main.layoutManager.addChrome(button, {
        affectsInputRegion: visible,
        trackFullscreen: !this._cachedSettings.showAboveFullscreen,
      });

      button.reactive = visible;

      // Use a smooth transition if required.
      if (doEase) {
        this._ease(button, {opacity: visible ? this._cachedSettings.opacity : 0});
      } else {
        button.opacity = visible ? this._cachedSettings.opacity : 0;
      }
    });
  }

  // Little helper which smoothly transitions the given properties of the provided
  // Clutter.Actor.
  _ease(actor, params) {
    actor.ease(Object.assign(params, {
      duration: this._cachedSettings.easingDuration,
      mode: Clutter.AnimationMode.EASE_OUT_QUAD
    }));
  }

  // Makes sure that all events from the pointing device we received last input from is
  // passed to the given actor. This is used to ensure that we do not "loose" the touch
  // buttons will dragging them around.
  _grab(actor) {
    if (this._latestInputDevice) {
      this._latestInputDevice.grab(actor);
      global.begin_modal(global.get_current_time(), 0);
    }
  }

  // Releases a grab created with the method above.
  _ungrab() {
    if (this._latestInputDevice) {
      this._latestInputDevice.ungrab();
      global.end_modal(global.get_current_time());
    }
  }
};
