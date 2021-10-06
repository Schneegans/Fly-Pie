//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const {GObject, Gtk} = imports.gi;

const _ = imports.gettext.domain('flypie').gettext;

const Me    = imports.misc.extensionUtils.getCurrentExtension();
const utils = Me.imports.src.common.utils;

//////////////////////////////////////////////////////////////////////////////////////////
// Since the FileChooserButton from GTK3 is gone, we have to provide a similar          //
// solution. In Fly-Pie, we only need file chooser buttons for images, so the content   //
// type is hard-coded.                                                                  //
//////////////////////////////////////////////////////////////////////////////////////////

function registerWidget() {

  if (GObject.type_from_name('FlyPieImageChooserButton') == null) {
    // clang-format off
      GObject.registerClass({
        GTypeName: 'FlyPieImageChooserButton',
        Template: `resource:///ui/${utils.gtk4() ? "gtk4" : "gtk3"}/imageChooserButton.ui`,
        InternalChildren: ['button', 'label', 'resetButton'],
        Signals: {
          'file-set': {}
        }
      },
      class FlyPieImageChooserButton extends Gtk.Box {
      // clang-format on
      _init(params = {}) {
        super._init(params);

        this._dialog = new Gtk.Dialog({use_header_bar: true, modal: true, title: ''});
        this._dialog.add_button(_('Select File'), Gtk.ResponseType.OK);
        this._dialog.add_button(_('Cancel'), Gtk.ResponseType.CANCEL);
        this._dialog.set_default_response(Gtk.ResponseType.OK);

        const fileFilter = new Gtk.FileFilter();
        fileFilter.add_mime_type('image/*');

        this._fileChooser = new Gtk.FileChooserWidget({
          action: Gtk.FileChooserAction.OPEN,
          hexpand: true,
          vexpand: true,
          height_request: 500,
          filter: fileFilter
        });

        utils.boxAppend(this._dialog.get_content_area(), this._fileChooser);

        this._dialog.connect('response', (dialog, id) => {
          if (id == Gtk.ResponseType.OK) {
            this.set_file(this._fileChooser.get_file());
            this.emit('file-set');
          }
          dialog.hide();
        });

        this._button.connect('clicked', (button) => {
          this._dialog.set_transient_for(utils.getRoot(button));

          if (utils.gtk4()) {
            this._dialog.show();
          } else {
            this._dialog.show_all();
          }

          if (this._file != null) {
            this._fileChooser.set_file(this._file);
          }
        });

        this._resetButton.connect('clicked', (button) => {
          this.set_file(null);
          this.emit('file-set');
        });
      }

      // Returns the currently selected file.
      get_file() {
        return this._file;
      }

      // This makes the file chooser dialog to preselect the given file.
      set_file(value) {
        if (value != null && value.query_exists(null)) {
          this._label.label = value.get_basename();
        } else {
          this._label.label = _('(None)');
        }

        this._file = value;
      }
    });
  }
}