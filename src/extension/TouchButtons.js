//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Main                 = imports.ui.main;
const {Meta, Clutter, Gio} = imports.gi;

const Me            = imports.misc.extensionUtils.getCurrentExtension();
const utils         = Me.imports.src.common.utils;
const DBusInterface = Me.imports.src.common.DBusInterface.DBusInterface;
const MenuItem      = Me.imports.src.extension.MenuItem.MenuItem;

const DBusWrapper = Gio.DBusProxy.makeProxyWrapper(DBusInterface.description);

//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////


const INACTIVE_OPACITY = 50;
const DRAG_OPACITY     = 100;
const DRAG_SCALE       = 0.7;

var TouchButtons = class TouchButtons {

  // ------------------------------------------------------------ constructor / destructor

  constructor(settings) {

    this._settings          = settings;
    this._touchButtons      = [];
    this._configs           = [];
    this._startupCompleteID = 0;
    this._inOverview        = false;

    // Connect to the server so that we can toggle the demo menu from the tutorial.
    new DBusWrapper(
        Gio.DBus.session, 'org.gnome.Shell', '/org/gnome/shell/extensions/flypie',
        proxy => {
          this._dbus = proxy;
          this._dbus.connectSignal('OnSelect', () => this._toggleButtons(true));
          this._dbus.connectSignal('OnCancel', () => this._toggleButtons(true));
        });

    this._shownOverviewID = Main.overview.connect('showing', () => {
      this._toggleButtons(false);
      this._inOverview = true;
    });
    this._hideOverviewID  = Main.overview.connect('hiding', () => {
      this._toggleButtons(true);
      this._inOverview = false;
    });

    this.onSettingsChange();
  }

  destroy() {
    this._touchButtons.forEach(button => button.destroy());
    this._touchButtons = [];

    if (this._startupCompleteID) {
      Main.layoutManager.disconnect(this._startupCompleteID);
      this._startupCompleteID = 0;
    }

    Main.overview.disconnect(this._shownOverviewID);
    Main.overview.disconnect(this._hideOverviewID);
  }

  // -------------------------------------------------------------------- public interface

  setMenuConfigs(configs) {
    this._configs = configs;

    if (Main.layoutManager._startingUp) {
      this._startupCompleteID =
          Main.layoutManager.connect('startup-complete', () => this._createButtons());
    } else {
      this._createButtons();
    }
  }

  onSettingsChange() {

    const globalScale = this._settings.get_double('global-scale');

    // clang-format off
    this._cachedSettings = {
      easingDuration:  this._settings.get_double('easing-duration') * 1000,
      textColor:       Clutter.Color.from_string(this._settings.get_string('text-color'))[1],
      font:            this._settings.get_string('font'),
      size:            this._settings.get_double('center-size-hover') * globalScale,
      iconScale:       this._settings.get_double('center-icon-scale-hover'),
      iconCrop:        this._settings.get_double('center-icon-crop-hover'),
      iconOpacity:     this._settings.get_double('center-icon-opacity-hover'),
      backgroundImage: MenuItem.loadBackgroundImage(this._settings.get_string('center-background-image-hover'),
                                                    this._settings.get_double('center-size-hover') * globalScale)
    };
    // clang-format on

    const colorMode = this._settings.get_string('center-color-mode-hover');

    // If the color mode is 'auto', we calculate an average color of the icon.
    if (colorMode == 'auto') {

      const iconName = this._settings.get_string('center-background-image-hover');

      // Compute the average color on a smaller version of the icon.
      const surface          = utils.createIcon(iconName, 24, this._cachedSettings.font, {
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

      this._cachedSettings.backgroundColor =
          MenuItem.getAutoColor(averageIconColor, luminance, saturation, opacity);

    } else {
      this._cachedSettings.backgroundColor = Clutter.Color.from_string(
          this._settings.get_string('center-fixed-color-hover'))[1];
    }

    this._createButtons();
  }

  // ----------------------------------------------------------------------- private stuff

  _toggleButtons(enable) {
    this._touchButtons.forEach(button => {
      button.reactive = enable;
      this._ease(button, {opacity: enable ? INACTIVE_OPACITY : 0});
    });
  }

  _createButtons() {
    this._touchButtons.forEach(button => button.destroy());
    this._touchButtons = [];

    this._configs.forEach(config => {
      if (config.touchButton) {
        const actor = MenuItem.createIcon(
            this._cachedSettings.backgroundColor, this._cachedSettings.backgroundImage,
            this._cachedSettings.size, config.icon, this._cachedSettings.iconScale,
            this._cachedSettings.iconCrop, this._cachedSettings.iconOpacity,
            this._cachedSettings.textColor, this._cachedSettings.font);
        actor.name     = `Fly-Pie TouchButton (${config.name})`;
        actor.width    = this._cachedSettings.size;
        actor.height   = this._cachedSettings.size;
        actor.opacity  = this._inOverview ? 0 : INACTIVE_OPACITY;
        actor.reactive = !this._inOverview;

        Main.layoutManager.addChrome(actor);
        this._touchButtons.push(actor);

        actor.connect('enter-event', (a) => {
          if (!a._dragging) {
            this._ease(actor, {opacity: 255});
          }
        });

        actor.connect('leave-event', (a) => {
          if (!a._dragging) {
            this._ease(actor, {opacity: INACTIVE_OPACITY});
          }
        });

        actor.connect('motion-event', (a, event) => {
          if (a._dragging) {
            const [x, y] = event.get_coords();
            a.x          = x - a._dragStartX;
            a.y          = y - a._dragStartY;
          }
          return true;
        });

        actor.connect('button-release-event', (actor, event) => {
          if (actor._dragging) {

            const pointer =
                Clutter.get_default_backend().get_default_seat().get_pointer();
            pointer.ungrab();

            global.end_modal(global.get_current_time());

            global.display.set_cursor(Meta.Cursor.DEFAULT);

            actor._dragging = false;
            this._ease(actor, {opacity: 255});
            this._ease(actor, {scale_x: 1});
            this._ease(actor, {scale_y: 1});
          }
        });

        const action = Clutter.ClickAction.new();
        action.connect('long-press', (action, actor, state) => {
          if (state == Clutter.LongPressState.QUERY) {
            return true;
          } else if (state == Clutter.LongPressState.ACTIVATE) {
            let x, y, ok;
            [x, y]     = action.get_coords();
            [ok, x, y] = actor.transform_stage_point(x, y);
            actor.set_pivot_point(x / actor.width, y / actor.height);
            this._ease(actor, {opacity: DRAG_OPACITY});
            this._ease(actor, {scale_x: DRAG_SCALE});
            this._ease(actor, {scale_y: DRAG_SCALE});

            actor._dragging   = true;
            actor._dragStartX = x;
            actor._dragStartY = y;

            const pointer =
                Clutter.get_default_backend().get_default_seat().get_pointer();
            pointer.grab(actor);

            global.begin_modal(global.get_current_time(), 0);

            global.display.set_cursor(Meta.Cursor.DND_IN_DRAG);


          } else if (state == Clutter.LongPressState.CANCEL) {
            this._toggleButtons(false);
            this._dbus.ShowMenuAtRemote(
                config.name, actor.x + actor.width / 2, actor.y + actor.height / 2);
          }
        });
        actor.add_action(action);
      }
    });
  }

  _ease(actor, params) {
    actor.ease(Object.assign(params, {
      duration: this._cachedSettings.easingDuration,
      mode: Clutter.AnimationMode.EASE_OUT_QUAD
    }));
  }
};