//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const {Gio, GdkPixbuf} = imports.gi;

const Me            = imports.misc.extensionUtils.getCurrentExtension();
const utils         = Me.imports.common.utils;
const DBusInterface = Me.imports.common.DBusInterface.DBusInterface;
const Timer         = Me.imports.common.Timer.Timer;
const ExampleMenu   = Me.imports.settings.ExampleMenu.ExampleMenu;

const DBusWrapper = Gio.DBusProxy.makeProxyWrapper(DBusInterface.description);

//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////

var Tutorial = class Tutorial {

  // ------------------------------------------------------------ constructor / destructor

  constructor(builder, settings) {
    try {


      // Keep a reference to the builder and the settings.
      this._builder  = builder;
      this._settings = settings;

      this._timer = new Timer();

      // Connect to the server so that we can toggle menu previews from the menu editor.
      new DBusWrapper(
          Gio.DBus.session, 'org.gnome.Shell', '/org/gnome/shell/extensions/flypie',
          proxy => {
            this._dbus = proxy;
            this._dbus.connectSignal('OnSelect', (proxy, sender, [id, path]) => {
              try {
                if (id == this._lastID && path == '/1/2/0') {
                  const time     = this._timer.getElapsed();
                  const bestTime = this._settings.get_double('best-tutorial-time');

                  this._settings.set_double('last-tutorial-time', time);

                  if (time < bestTime) {
                    this._settings.set_double('best-tutorial-time', time);
                  }
                }
              } catch (error) {
                utils.notification('Failed to setup tutorial page: ' + error);
              }
            });
          });

      const tutorialPages = 6;

      let stack      = this._builder.get_object('tutorial-stack');
      let prevButton = this._builder.get_object('tutorial-previous-page-button');
      let nextButton = this._builder.get_object('tutorial-next-page-button');

      for (let i = 0; i < tutorialPages; i++) {
        this._builder.get_object('tutorial-page-button-' + i)
            .connect('toggled', button => {
              if (button.active) {
                stack.set_visible_child_name('tutorial-page-' + i);

                prevButton.sensitive = i != 0;
                nextButton.sensitive = i != tutorialPages - 1;
              }
            });
      }

      nextButton.connect('clicked', button => {
        let active = parseInt(stack.get_visible_child_name().slice(-1));
        let next   = Math.min(tutorialPages - 1, active + 1);
        this._builder.get_object('tutorial-page-button-' + next).set_active(true);
      });

      prevButton.connect('clicked', button => {
        let active   = parseInt(stack.get_visible_child_name().slice(-1));
        let previous = Math.max(0, active - 1);
        this._builder.get_object('tutorial-page-button-' + previous).set_active(true);
      });

      const gifs = 3;
      for (let i = 1; i <= gifs; i++) {
        this._builder.get_object('tutorial-animation-' + i)
            .set_from_animation(GdkPixbuf.PixbufAnimation.new_from_file(
                Me.path + '/resources/tutorial' + i + '.gif'));
      }

      const buttons = 5;
      for (let i = 1; i <= buttons; i++) {
        this._builder.get_object('tutorial-button-' + i).connect('clicked', () => {
          if (this._dbus) {
            this._dbus.ShowCustomMenuRemote(JSON.stringify(ExampleMenu.get()), (id) => {
              if (id >= 0) {
                this._timer.reset();
                this._lastID = id;
              }
            });
          }
        });
      }

      this._settings.connect('changed::best-tutorial-time', () => this._updateState());
      this._settings.connect('changed::last-tutorial-time', () => this._updateState());

      for (let i = 1; i <= 2; i++) {
        this._builder.get_object('tutorial-reset-button-' + i).connect('clicked', () => {
          this._settings.reset('best-tutorial-time');
          this._settings.reset('last-tutorial-time');
        });
      }

      this._updateState();

    } catch (error) {
      utils.notification('Failed to setup tutorial page: ' + error);
    }
  }

  // ----------------------------------------------------------------------- private stuff

  _updateState() {
    const bestTime = this._settings.get_double('best-tutorial-time');
    const lastTime = this._settings.get_double('last-tutorial-time');

    let text = '<big>Last selection time: <b>%d ms</b></big>'.format(lastTime);
    this._builder.get_object('last-selection-time-1').label = text;
    this._builder.get_object('last-selection-time-2').label = text;

    text = '<big>Best selection time: <b>%d ms</b></big>'.format(bestTime);
    this._builder.get_object('best-selection-time-1').label = text;
    this._builder.get_object('best-selection-time-2').label = text;

    this._builder.get_object('gold-medal-1').opacity   = bestTime < 1000 ? 1.0 : 0.1;
    this._builder.get_object('gold-medal-2').opacity   = bestTime < 500 ? 1.0 : 0.1;
    this._builder.get_object('silver-medal-1').opacity = bestTime < 2000 ? 1.0 : 0.1;
    this._builder.get_object('silver-medal-2').opacity = bestTime < 750 ? 1.0 : 0.1;
    this._builder.get_object('bronze-medal-1').opacity = bestTime < 3000 ? 1.0 : 0.1;
    this._builder.get_object('bronze-medal-2').opacity = bestTime < 1000 ? 1.0 : 0.1;
  }
}