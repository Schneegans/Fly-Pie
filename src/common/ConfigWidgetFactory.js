//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const {Gtk, Gdk} = imports.gi;

const _ = imports.gettext.domain('flypie').gettext;

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
  static createTextWidget(name, description, text, callback) {
    const box = this.createConfigWidgetCaption(name, description);

    const entry = new Gtk.Entry({text: text});
    box.pack_start(entry, false, false, 0);

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
    box.pack_start(entry, false, false, 0);

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
    box.pack_start(entryBox, false, false, 0);

    const button = new Gtk.MenuButton();
    button.image = Gtk.Image.new_from_icon_name('gtk-find', Gtk.IconSize.BUTTON);

    const popover = new Gtk.Popover();
    button.set_popover(popover);

    const fileChooser = new Gtk.FileChooserWidget({
      action: Gtk.FileChooserAction.OPEN,
      margin: 5,
      height_request: 375,
      width_request: 600
    });

    popover.add(fileChooser);

    fileChooser.show();

    entryBox.pack_start(button, false, false, 0);

    const entry = new Gtk.Entry({text: file});
    entryBox.pack_start(entry, true, true, 0);

    // Initialize the file-select-popover. When a file is activated, the popover is
    // hidden, when a file is selected, the item's name, icon and file input fields are
    // updated accordingly.
    fileChooser.connect('file-activated', () => {
      popover.popdown();
    });

    fileChooser.connect('selection-changed', (widget) => {
      if (widget.get_file()) {
        const info = widget.get_file().query_info('standard::icon', 0, null);
        callback(
            widget.get_filename(), widget.get_file().get_basename(),
            info.get_icon().to_string());
        entry.text = widget.get_filename();
      }
    });

    entry.connect('notify::text', (widget) => {
      callback(widget.text);
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
    box.pack_start(entryBox, false, false, 0);

    const button = new Gtk.MenuButton();
    button.image = Gtk.Image.new_from_icon_name('gtk-find', Gtk.IconSize.BUTTON);

    const popover = new Gtk.Popover();
    button.set_popover(popover);

    const appChooser = new Gtk.AppChooserWidget({show_all: true, margin: 5});
    popover.add(appChooser);

    appChooser.show();

    entryBox.pack_start(button, false, false, 0);

    const entry = new Gtk.Entry({text: command});
    entryBox.pack_start(entry, true, true, 0);

    // Initialize the application-select-popover. On mouse-up the popover is hidden,
    // whenever an application is selected, the item's name, icon and command input fields
    // are updated accordingly.
    appChooser.connect('button-release-event', () => {
      popover.popdown();
    });

    appChooser.connect('application-selected', (widget, app) => {
      callback(app.get_commandline(), app.get_display_name(), app.get_icon().to_string());
      entry.text = app.get_commandline();
    });

    entry.connect('notify::text', (widget) => {
      callback(widget.text);
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
    box.pack_start(container, false, false, 0);

    return box;
  }

  // This is used by all the function above to create the header of the configuration
  // widget. It returns a vertical Gtk.Box containing a horizontal box with the name and
  // the dimmed description.
  static createConfigWidgetCaption(name, description) {
    const vBox =
        new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 5, margin_top: 20});
    const hBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL});

    vBox.pack_start(hBox, false, false, 0);

    // This is shown on the left above the data widget.
    const nameLabel = new Gtk.Label({label: name});

    // This is shown on the right above the data widget.
    const descriptionLabel = new Gtk.Label({label: description});
    descriptionLabel.get_style_context().add_class('dim-label');

    hBox.pack_start(nameLabel, false, false, 0);
    hBox.pack_end(descriptionLabel, false, false, 0);

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
    const frame   = new Gtk.Frame({shadow_type: Gtk.ShadowType.IN});
    const listBox = new Gtk.ListBox();
    const row     = new Gtk.ListBoxRow({height_request: 50});

    frame.add(listBox);
    listBox.add(row);

    const label = new Gtk.ShortcutLabel({
      // Translators: This is shown on the shortcut-buttons when no shortcut is selected.
      disabled_text: _('Not bound.'),
      halign: Gtk.Align.CENTER,
      valign: Gtk.Align.CENTER
    });
    row.add(label);

    // Whenever the widget is in the please-select-something-state, the label is cleared
    // and a text indicating that the user should press the shortcut is shown. To be able
    // to reset to the state before (e.g. when ESC is pressed), this stores the previous
    // value.
    let lastAccelerator = '';

    // This function grabs the keyboard input. If doFullGrab == true, the complete
    // keyboard input of the default Seat will be grabbed. Else only a Gtk grab is
    // performed. The text of the Gtk.ShortcutLabel is changed to indicate that the widget
    // is waiting for input.
    const grabKeyboard = () => {
      if (doFullGrab) {
        const seat = Gdk.Display.get_default().get_default_seat();
        seat.grab(
            row.get_window(), Gdk.SeatCapabilities.KEYBOARD, false, null, null, null);
      }
      row.grab_add();
      lastAccelerator = label.get_accelerator();
      label.set_accelerator('');
      label.set_disabled_text(
          _('Press the shortcut!\nESC to cancel, BackSpace to unbind'));
    };

    // This function cancels any previous grab. The label's disabled-text is reset to "Not
    // bound".
    const cancelGrab = () => {
      if (doFullGrab) {
        const seat = Gdk.Display.get_default().get_default_seat();
        seat.ungrab();
      }
      row.grab_remove();
      row.parent.unselect_all();
      label.set_disabled_text(_('Not bound.'));
    };

    // When the row is activated, the input is grabbed.
    row.parent.connect('row-activated', (row) => {
      grabKeyboard();
    });

    // Key input events are received once the input is grabbed.
    row.connect('key-press-event', (row, event) => {
      if (row.is_selected()) {
        const keyval = event.get_keyval()[1];
        const mods   = event.get_state()[1] & Gtk.accelerator_get_default_mod_mask();

        if (keyval == Gdk.KEY_Escape) {
          // Escape cancels the shortcut selection.
          label.set_accelerator(lastAccelerator);
          cancelGrab();

        } else if (keyval == Gdk.KEY_BackSpace) {
          // BackSpace removes any bindings.
          label.set_accelerator('');
          onSelect('');
          cancelGrab();

        } else if (Gtk.accelerator_valid(keyval, mods)) {
          // Else, if a valid accelerator was pressed, we store it.
          const accelerator = Gtk.accelerator_name(keyval, mods);
          onSelect(accelerator);
          label.set_accelerator(accelerator);
          cancelGrab();
        }

        return true;
      }
      return false;
    });

    // Clicking with the mouse cancels the shortcut selection.
    row.connect('button-press-event', () => {
      if (row.has_grab()) {
        label.set_accelerator(lastAccelerator);
        cancelGrab();
      }
      return true;
    });

    return [frame, label];
  }
}