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

      // Connect to the server so that we can toggle menu previews from the menu editor.
      new DBusWrapper(
          Gio.DBus.session, 'org.gnome.Shell', '/org/gnome/shell/extensions/flypie',
          proxy => this._dbus = proxy);

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
            this._dbus.ShowCustomMenuRemote(JSON.stringify(ExampleMenu.get()), () => {});
          }
        });
      }

    } catch (error) {
      utils.notification('Failed to setup tutorial page: ' + error);
    }
  }

  // ----------------------------------------------------------------------- private stuff
}