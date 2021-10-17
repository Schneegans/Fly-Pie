//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const {Gio, Gtk, Gdk} = imports.gi;

const _ = imports.gettext.domain('flypie').gettext;

const Me    = imports.misc.extensionUtils.getCurrentExtension();
const utils = Me.imports.src.common.utils;

//////////////////////////////////////////////////////////////////////////////////////////
// This class contains some static utility functions which can be used to create        //
// configuration widgets for the items in the menu editor.                              //
//                                                                                      //
// Each menu item may have additional properties set by the user. The Gtk.Widgets       //
// required to do this are created by the config.getWidget() methods of the individual  //
// item types. While all the code below could be directly put into these methods, they  //
// are oftentimes quite similar and therefore in this file here.                        //
//////////////////////////////////////////////////////////////////////////////////////////

var ConfigWidgetFactory = class ConfigWidgetFactory {

  // ---------------------------------------------------------------------- static methods

  // This creates a widget which can be used to adjust a line of text. The 'name' and
  // 'description' are shown above and 'text' is the initial value. 'callback(text)' will
  // be fired whenever the text is edited. The function returns a Gtk.Box containing all
  // the required widgets.
  static createTextWidget(name, description, tooltip, text, callback) {
    const box = this.createConfigWidgetCaption(name, description);

    const entry = new Gtk.Entry({text: text, tooltip_markup: tooltip});
    utils.boxAppend(box, entry);

    entry.connect('notify::text', (widget) => {
      callback(widget.text);
    });

    return box;
  }

  // This creates a widget which can be used to adjust a number. The 'name' and
  // 'description' are shown above, 'min' and 'max' define the allowed value range, 'step'
  // the allowed increment and 'value' is the initial value. 'callback(number)' will be
  // fired whenever a new number is chosen. The function returns a Gtk.Box
  // containing all the required widgets.
  static createCountWidget(name, description, min, max, step, value, callback) {
    const box = this.createConfigWidgetCaption(name, description);

    const entry = Gtk.SpinButton.new_with_range(min, max, step);
    entry.value = value;
    utils.boxAppend(box, entry);

    entry.connect('notify::value', (widget) => {
      callback(widget.value);
    });

    return box;
  }

  // This creates a widget which can be used to select a file. The 'name' and
  // 'description' are shown above, 'file' is the initial value, and 'callback(file,
  // name, icon)' will be fired whenever a new application is selected. The function
  // returns a Gtk.Box containing all the required widgets. Note that 'icon' and 'name'
  // passed to the callback may be undefined when the user directly edited the file path.
  static createFileWidget(name, description, file, callback) {
    const box = this.createConfigWidgetCaption(name, description);

    const entryBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});
    entryBox.get_style_context().add_class('linked');
    utils.boxAppend(box, entryBox);

    let button;
    if (utils.gtk4()) {
      button = Gtk.Button.new_from_icon_name('view-more-symbolic');
    } else {
      button = Gtk.Button.new_from_icon_name('view-more-symbolic', Gtk.IconSize.BUTTON);
    }

    const entry = new Gtk.Entry({text: file, hexpand: true});
    utils.boxAppend(entryBox, entry, false, true);
    utils.boxAppend(entryBox, button);

    entry.connect('notify::text', (widget) => {
      callback(widget.text);
    });

    button.connect('clicked', () => {
      const dialog = new Gtk.Dialog({
        use_header_bar: true,
        modal: true,
        transient_for: utils.getRoot(button),
        title: ''
      });
      dialog.add_button(_('Select File'), Gtk.ResponseType.OK);
      dialog.add_button(_('Cancel'), Gtk.ResponseType.CANCEL);
      dialog.set_default_response(Gtk.ResponseType.OK);

      const fileChooser = new Gtk.FileChooserWidget({
        action: Gtk.FileChooserAction.OPEN,
        hexpand: true,
        vexpand: true,
        height_request: 500
      });

      const currentFile = Gio.File.new_for_path(entry.text);
      if (currentFile.query_exists(null)) {
        fileChooser.set_file(currentFile);
      }

      utils.boxAppend(dialog.get_content_area(), fileChooser);

      dialog.connect('response', (dialog, id) => {
        if (id == Gtk.ResponseType.OK) {
          const file = fileChooser.get_file();
          if (file) {
            const info = file.query_info('standard::icon', 0, null);
            callback(file.get_path(), file.get_basename(), info.get_icon().to_string());
            entry.text = file.get_path();
          }
        }
        dialog.destroy();
      });

      if (utils.gtk4()) {
        dialog.show();
      } else {
        dialog.show_all();
      }
    });



    return box;
  }

  // This creates a widget which can be used to select an application. The 'name' and
  // 'description' are shown above, 'command' is the initial value, and 'callback(command,
  // name, icon)' will be fired whenever a new application is selected. The function
  // returns a Gtk.Box containing all the required widgets. Note that 'icon' and 'name'
  // passed to the callback may be undefined when the user directly edited the command.
  static createCommandWidget(name, description, command, callback) {
    const box = this.createConfigWidgetCaption(name, description);

    const entryBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});
    entryBox.get_style_context().add_class('linked');
    utils.boxAppend(box, entryBox);

    let button;
    if (utils.gtk4()) {
      button = Gtk.Button.new_from_icon_name('view-more-symbolic');
    } else {
      button = Gtk.Button.new_from_icon_name('view-more-symbolic', Gtk.IconSize.BUTTON);
    }

    const entry = new Gtk.Entry({text: command, hexpand: true});
    utils.boxAppend(entryBox, entry, false, true);
    utils.boxAppend(entryBox, button);

    entry.connect('notify::text', (widget) => {
      callback(widget.text);
    });

    button.connect('clicked', () => {
      const dialog = new Gtk.Dialog({
        use_header_bar: true,
        modal: true,
        transient_for: utils.getRoot(button),
        title: ''
      });
      dialog.add_button(_('Select Application'), Gtk.ResponseType.OK);
      dialog.add_button(_('Cancel'), Gtk.ResponseType.CANCEL);
      dialog.set_default_response(Gtk.ResponseType.OK);

      const appChooser =
          new Gtk.AppChooserWidget({show_all: true, hexpand: true, vexpand: true});

      utils.boxAppend(dialog.get_content_area(), appChooser);

      const selectApp = (app) => {
        callback(
            app.get_commandline(), app.get_display_name(), app.get_icon().to_string());
        entry.text = app.get_commandline();
      };

      dialog.connect('response', (dialog, id) => {
        if (id == Gtk.ResponseType.OK) {
          selectApp(appChooser.get_app_info());
        }
        dialog.destroy();
      });

      appChooser.connect('application-activated', (widget, app) => {
        selectApp(app);
        dialog.destroy();
      });

      if (utils.gtk4()) {
        dialog.show();
      } else {
        dialog.show_all();
      }
    });



    return box;
  }

  // This creates a widget which can be used to select a shortcut. The 'name' and
  // 'description' are shown above, 'shortcut' is the initial value, and
  // 'callback(shortcut)' will be fired whenever a new shortcut is selected. The function
  // returns a Gtk.Box containing all the required widgets.
  static createShortcutWidget(name, description, shortcut, callback) {

    const [container, label] = this.createShortcutLabel(true, callback);
    label.set_accelerator(shortcut);

    const box = this.createConfigWidgetCaption(name, description);
    utils.boxAppend(box, container);

    return box;
  }

  // This is used by all the function above to create the header of the configuration
  // widget. It returns a vertical Gtk.Box containing a horizontal box with the name and
  // the dimmed description.
  static createConfigWidgetCaption(name, description) {
    const vBox =
        new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 5, margin_top: 20});
    const hBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 10});

    utils.boxAppend(vBox, hBox);

    // This is shown on the left above the data widget.
    const nameLabel =
        new Gtk.Label({label: name, hexpand: true, halign: Gtk.Align.START});

    // This is shown on the right above the data widget.
    const descriptionLabel = new Gtk.Label({label: description});
    descriptionLabel.get_style_context().add_class('dim-label');

    utils.boxAppend(hBox, nameLabel, false, true);
    utils.boxAppend(hBox, descriptionLabel);

    return vBox;
  }


  // This creates a widget which can be used to select a shortcut. A Gtk.ShortcutLabel is
  // used to visualize the shortcut.
  // The doFullGrab parameter enables selection of shortcuts which are already bound to
  // something else. For example, imagine you have configured opening a terminal via
  // Ctrl+Alt+T in your system settings. Now if doFullGrab == false, selecting Ctrl+Alt+T
  // will not work; it will open the terminal instead. However, if doFullGrab == true, you
  // will be able to select Ctrl+Alt+T. This is very important - we do not want to
  // bind menus to shortcuts which are bound to something else - but we want menu
  // items to simulate shortcut presses which are actually bound to something else!
  // The onSelect callback will be fired whenever a new shortcut is select and will
  // receive the shortcut as a string parameter.
  // The function returns two things [Gtk.Frame, Gtk.ShortcutLabel]. The former is the
  // container which should be added to something, the latter is the internal label. You
  // can use the set_accelerator method of this label to adjust the currently shown
  // shortcut programmatically.
  static createShortcutLabel(doFullGrab, onSelect) {
    const frame   = new Gtk.Frame();
    const listBox = new Gtk.ListBox();
    const row     = new Gtk.ListBoxRow({height_request: 50});

    utils.setChild(frame, listBox);

    if (utils.gtk4()) {
      listBox.append(row);
    } else {
      listBox.add(row);
    }

    const label = new Gtk.ShortcutLabel({
      // Translators: This is shown on the shortcut-buttons when no shortcut is selected.
      disabled_text: _('Not Bound'),
      halign: Gtk.Align.CENTER,
      valign: Gtk.Align.CENTER
    });
    utils.setChild(row, label);

    // Whenever the widget is in the please-select-something-state, the label is cleared
    // and a text indicating that the user should press the shortcut is shown. To be able
    // to reset to the state before (e.g. when ESC is pressed), this stores the previous
    // value.
    let lastAccelerator = '';
    let isGrabbed       = false;

    // This function grabs the keyboard input. If doFullGrab == true, the complete
    // keyboard input of the default Seat will be grabbed. Else only a Gtk grab is
    // performed. The text of the Gtk.ShortcutLabel is changed to indicate that the widget
    // is waiting for input.
    const grabKeyboard = () => {
      if (doFullGrab) {
        if (utils.gtk4()) {
          utils.getRoot(label).get_surface().inhibit_system_shortcuts(null);
        } else {
          const seat = Gdk.Display.get_default().get_default_seat();
          seat.grab(
              row.get_window(), Gdk.SeatCapabilities.KEYBOARD, false, null, null, null);
        }
      }
      isGrabbed       = true;
      lastAccelerator = label.get_accelerator();
      label.set_accelerator('');
      label.set_disabled_text(
          _('Press the shortcut!\nESC to cancel, BackSpace to unbind'));
    };

    // This function cancels any previous grab. The label's disabled-text is reset to "Not
    // bound".
    const cancelGrab = () => {
      if (doFullGrab) {
        if (utils.gtk4()) {
          utils.getRoot(label).get_surface().restore_system_shortcuts();
        } else {
          const seat = Gdk.Display.get_default().get_default_seat();
          seat.ungrab();
        }
      }
      isGrabbed = false;
      label.set_accelerator(lastAccelerator);
      row.parent.unselect_all();
      label.set_disabled_text(_('Not Bound'));
    };

    // When the row is activated, the input is grabbed. If it's already grabbed, un-grab
    // it.
    row.parent.connect('row-activated', () => {
      if (isGrabbed) {
        cancelGrab();
      } else {
        grabKeyboard();
      }
    });

    // Key input events are received once the input is grabbed.
    {
      const handler = (keyval, state) => {
        if (row.is_selected()) {
          const mods = state & Gtk.accelerator_get_default_mod_mask();

          if (keyval == Gdk.KEY_Escape) {
            // Escape cancels the shortcut selection.
            cancelGrab();

          } else if (keyval == Gdk.KEY_BackSpace) {
            // BackSpace removes any bindings.
            lastAccelerator = '';
            onSelect('');
            cancelGrab();

          } else if (
              Gtk.accelerator_valid(keyval, mods) || keyval == Gdk.KEY_Tab ||
              keyval == Gdk.KEY_ISO_Left_Tab || keyval == Gdk.KEY_KP_Tab) {
            // Else, if a valid accelerator was pressed, we store it. The tab key is for
            // some reason not considered to be a valid key for accelerators.
            const accelerator = Gtk.accelerator_name(keyval, mods);
            onSelect(accelerator);
            lastAccelerator = accelerator;
            cancelGrab();
          }

          return true;
        }
        return false;
      };

      if (utils.gtk4()) {
        const controller = Gtk.EventControllerKey.new();
        controller.connect(
            'key-pressed', (c, keyval, keycode, state) => handler(keyval, state));
        row.add_controller(controller);
      } else {
        row.connect('key-press-event', (row, event) => {
          const keyval = event.get_keyval()[1];
          const state  = event.get_state()[1];
          return handler(keyval, state);
        });
      }
    }

    // Clicking somewhere else cancels the shortcut selection.
    {
      const handler = () => {
        if (row.is_selected()) {
          label.set_accelerator(lastAccelerator);
          cancelGrab();
        }
        return true;
      };

      if (utils.gtk4()) {
        const controller = Gtk.EventControllerFocus.new();
        controller.connect('leave', handler);
        row.add_controller(controller);
      } else {
        row.connect('focus-out-event', handler);
      }
    }

    return [frame, label];
  }
}