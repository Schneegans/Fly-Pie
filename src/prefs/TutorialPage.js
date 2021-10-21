//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const {Gio, Gdk, Gtk, GdkPixbuf} = imports.gi;

const _ = imports.gettext.domain('flypie').gettext;

const Me            = imports.misc.extensionUtils.getCurrentExtension();
const utils         = Me.imports.src.common.utils;
const DBusInterface = Me.imports.src.common.DBusInterface.DBusInterface;
const Timer         = Me.imports.src.common.Timer.Timer;
const Statistics    = Me.imports.src.common.Statistics.Statistics;
const ExampleMenu   = Me.imports.src.prefs.ExampleMenu.ExampleMenu;

const DBusWrapper = Gio.DBusProxy.makeProxyWrapper(DBusInterface.description);

//////////////////////////////////////////////////////////////////////////////////////////
// The TutorialPage class encapsulates code required for the 'Tutorial' page of the     //
// settings dialog. It's not instantiated multiple times, nor does it have any public   //
// interface, hence it could just be copy-pasted to the PreferencesDialog class. But as //
// it's quite decoupled as well, it structures the code better when written to its own  //
// file.                                                                                //
//////////////////////////////////////////////////////////////////////////////////////////

var TutorialPage = class TutorialPage {

  // ------------------------------------------------------------ constructor / destructor

  constructor(builder, settings) {

    // Keep a reference to the builder and the settings.
    this._builder  = builder;
    this._settings = settings;

    // We keep several connections to the Gio.Settings object. Once the settings dialog is
    // closed, we use this array to disconnect all of them.
    this._settingsConnections = [];

    // This is used for measuring selection times for unlocking the medals.
    this._timer = new Timer();

    // Connect to the server so that we can toggle the demo menu from the tutorial.
    new DBusWrapper(
        Gio.DBus.session, 'org.gnome.Shell', '/org/gnome/shell/extensions/flypie',
        proxy => {
          this._dbus = proxy;
          this._dbus.connectSignal('OnSelect', (proxy, sender, [menuID, itemID]) => {
            // When the target item was selected, we store the last and best selection
            // time in the settings.
            if (menuID == this._lastID && itemID == '/1/3/0') {
              const time     = this._timer.getElapsed();
              const bestTime = this._settings.get_uint('stats-best-tutorial-time');

              this._settings.set_uint('stats-last-tutorial-time', time);

              if (time < bestTime) {
                this._settings.set_uint('stats-best-tutorial-time', time);
              }
            }
          });
        });

    // Connect the radio buttons buttons indicating the tutorial progress.
    const tutorialPages = 6;
    let stack           = this._builder.get_object('tutorial-stack');
    let prevButton      = this._builder.get_object('tutorial-previous-page-button');
    let nextButton      = this._builder.get_object('tutorial-next-page-button');

    for (let i = 0; i < tutorialPages; i++) {
      const radioButton = this._builder.get_object('tutorial-page-button-' + i);
      radioButton.connect('toggled', button => {
        if (button.active) {
          // When toggled to active, make the corresponding tutorial page visible.
          stack.set_visible_child_name('tutorial-page-' + i);

          // Make the "Next" and "Previous" buttons unresponsive on the first and
          // last page of the tutorial.
          prevButton.sensitive = i != 0;
          nextButton.sensitive = i != tutorialPages - 1;
        }
      });
    }

    // Activate next tutorial page when the "Next" button is clicked.
    nextButton.connect('clicked', button => {
      let active = parseInt(stack.get_visible_child_name().slice(-1));
      let next   = Math.min(tutorialPages - 1, active + 1);
      this._builder.get_object('tutorial-page-button-' + next).set_active(true);
    });

    // Activate previous tutorial page when the "Previous" button is clicked.
    prevButton.connect('clicked', button => {
      let active   = parseInt(stack.get_visible_child_name().slice(-1));
      let previous = Math.max(0, active - 1);
      this._builder.get_object('tutorial-page-button-' + previous).set_active(true);
    });

    // Draw the Fly-Pie logo with the current theme's foreground color.
    utils.setDrawFunc(this._builder.get_object('fly-pie-logo'), (widget, ctx) => {
      const color = utils.getColor(widget);
      const logo  = GdkPixbuf.Pixbuf.new_from_resource('/img/logo.svg');

      ctx.pushGroup();
      Gdk.cairo_set_source_pixbuf(ctx, logo, 0, 0);
      ctx.paint();
      const mask = ctx.popGroup();

      ctx.setSourceRGBA(color.red, color.green, color.blue, color.alpha);
      ctx.mask(mask);
    });

    // Initialize the two videos of the tutorial. This cannot be done from UI file
    // for now as the GtkVideo does not seem to have a resource property.
    for (let i = 1; i <= 2; i++) {
      const video = this._builder.get_object('tutorial-animation-' + i);

      if (utils.gtk4()) {
        video.set_resource('/video/video' + i + '.webm');
      } else {
        video.set_from_animation(
            GdkPixbuf.PixbufAnimation.new_from_resource('/video/video' + i + '.gif'));
      }
    }

    // Inject the tutorial selection goal (Hot Apple Pie) strings.
    for (let i = 1; i <= 2; i++) {
      const label = this._builder.get_object('tutorial-label-' + i);
      label.label = label.label.replace(
          '%s',
          `<b>${ExampleMenu.getItems()[0].names[1]}${ExampleMenu.getItems()[1].names[3]}${
              ExampleMenu.getItems()[2].names[0]}</b>`);
    }

    // Make the five Show-Menu buttons of the tutorial pages actually show a menu.
    for (let i = 1; i <= 5; i++) {
      this._builder.get_object('tutorial-button-' + i).connect('clicked', () => {
        this._dbus.ShowCustomMenuRemote(JSON.stringify(ExampleMenu.get()), (id) => {
          // When the menu is shown successfully, reset the timer and store the menu ID.
          if (id >= 0) {
            this._timer.reset();
            this._lastID = id;
            Statistics.getInstance().addTutorialMenuOpened();
          }
        });
      });
    }

    // Update medals and time labels when the selection time changes.
    this._settingsConnections.push(this._settings.connect(
        'changed::stats-best-tutorial-time', () => this._updateState()));
    this._settingsConnections.push(this._settings.connect(
        'changed::stats-last-tutorial-time', () => this._updateState()));

    // Update medals and time labels according to the stored last and best selection
    // times when the settings dialog is opened.
    this._updateState();
  }

  // Disconnects all settings connections.
  destroy() {
    this._settingsConnections.forEach(connection => {
      this._settings.disconnect(connection);
    });
  }

  // ----------------------------------------------------------------------- private stuff

  // This shows the last and best selection times in the user interface and "unlocks" the
  // medals if the best selection time was fast enough.
  _updateState() {
    const bestTime = this._settings.get_uint('stats-best-tutorial-time');
    const lastTime = this._settings.get_uint('stats-last-tutorial-time');

    // Translators: Do not translate '%d'. ms = milliseconds
    let text = _('<big>Last selection time: <b>%d ms</b></big>').format(lastTime);
    this._builder.get_object('last-selection-time-1').label = text;
    this._builder.get_object('last-selection-time-2').label = text;

    // Translators: Do not translate '%d'. ms = milliseconds
    text = _('<big>Best selection time: <b>%d ms</b></big>').format(bestTime);
    this._builder.get_object('best-selection-time-1').label = text;
    this._builder.get_object('best-selection-time-2').label = text;

    // These numbers are hard-coded here. If changed, the corresponding labels in the
    // settings.ui file must be changed as well!
    this._builder.get_object('gold-medal-1').opacity   = bestTime < 1000 ? 1.0 : 0.1;
    this._builder.get_object('gold-medal-2').opacity   = bestTime < 500 ? 1.0 : 0.1;
    this._builder.get_object('silver-medal-1').opacity = bestTime < 2000 ? 1.0 : 0.1;
    this._builder.get_object('silver-medal-2').opacity = bestTime < 750 ? 1.0 : 0.1;
    this._builder.get_object('bronze-medal-1').opacity = bestTime < 3000 ? 1.0 : 0.1;
    this._builder.get_object('bronze-medal-2').opacity = bestTime < 1000 ? 1.0 : 0.1;
  }
}