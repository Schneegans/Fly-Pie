//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const {Gio} = imports.gi;

const Me            = imports.misc.extensionUtils.getCurrentExtension();
const utils         = Me.imports.common.utils;
const DBusInterface = Me.imports.common.DBusInterface.DBusInterface;

const DBusWrapper = Gio.DBusProxy.makeProxyWrapper(DBusInterface.description);

//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////

var Tutorial = class Tutorial {

  // ------------------------------------------------------------ constructor / destructor

  constructor(builder) {
    try {


      // Keep a reference to the builder.
      this._builder = builder;

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

    } catch (error) {
      utils.notification('Failed to setup tutorial page: ' + error);
    }
  }

  // ----------------------------------------------------------------------- private stuff
}