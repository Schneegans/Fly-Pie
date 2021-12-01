//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const {Meta, Gio, GLib} = imports.gi;

const Me               = imports.misc.extensionUtils.getCurrentExtension();
const utils            = Me.imports.src.common.utils;
const InputManipulator = Me.imports.src.common.InputManipulator.InputManipulator;

//////////////////////////////////////////////////////////////////////////////////////////
// This singleton class is instantiated whenever the extension is loaded (by the Daemon //
// class). It monitors the clipboard and stores a certain amount of recently copied     //
// items. These are then used by the Clipboard menu to show a history of recently       //
// copied things. Menus in Fly-Pie are very volatile, they only exist while they are    //
// visible on screen. A user could open a custom menu over the D-Bus API containing a   //
// Clipboard menu. Therefore we always have to keep track of the last copied things,    //
// even if we usually do not require them.                                              //
// The clipboard is a very complex thing. In most cases, no data is stored, only an     //
// "owner" is registered alongside with it, a list of data formats (mime types) in      //
// which the owner could provide the copied data if requested (e.g. when the user       //
// presses Ctrl+V somewhere else). To store a history of copied things, the Clipboard-  //
// Manager has to request the data from the current owner. However, it cannot know      //
// beforehand, in which format any receiving application would like to have the data.   //
// So it just makes some assumptions and stores the data in a quite commonly used       //
// format and hopes that the receiver will understands the format.                      //
// Currently, these mime types are requested (in this order):                           //
// - 'x-special/gnome-copied-files'                                                     //
// - 'image/svg+xml'                                                                    //
// - 'image/png'                                                                        //
// - 'text/plain;charset=utf-8'                                                         //
// - 'text/plain'                                                                       //
// If the data can be provide in one of these formats, and can later be pasted in the   //
// same format.                                                                         //
//////////////////////////////////////////////////////////////////////////////////////////

// This class is supposed to be used as singleton. This global variable stores the
// singleton instance.
let _instance = null;

// We will store the last 20 items.
const MAX_ENTRIES = 20;

// We will not store things which are larger than 20 MB.
const MAX_DATA_SIZE_MB = 20;

var ClipboardManager = class ClipboardManager {

  // ---------------------------------------------------------------------- static methods

  // Create the singleton instance lazily.
  static getInstance() {
    if (_instance == null) {
      _instance = new ClipboardManager();
    }

    return _instance;
  }

  // This should be called when the Fly-Pie extension is disabled.
  static destroyInstance() {
    if (_instance != null) {
      _instance.destroy();
      _instance = null;
    }
  }

  // ------------------------------------------------------------ constructor / destructor

  // This should not be called directly. Use the static singleton interface above!
  constructor() {

    // This is used to paste items from the clipboard (by simulating Ctrl+V).
    this._input = new InputManipulator();

    // When we paste an item from the history, we have to transfer it to the clipboard
    // first. This will trigger a clipboard-changed event and then add the old item a
    // second time to the history. This flag is used to prevent this.
    this._ignoreNextOwnerChange = false;

    // This will eventually contain a list of copied things. Each entry contains a "type"
    // (string) and a "data" (ByteArray) property. The first item is the one copied most
    // recently.
    this._items = [];

    this._clipboardConnection =
        global.display.get_selection().connect('owner-changed', (s, type, owner) => {
          // We are only interested in the ordinary clipboard.
          if (type != Meta.SelectionType.SELECTION_CLIPBOARD) {
            return;
          }

          // If there is no owner anymore, this will be called as well.
          if (owner == null) {
            return;
          }

          // Ignore changes we induced ourselves.
          if (this._ignoreNextOwnerChange) {
            this._ignoreNextOwnerChange = false;
            return;
          }

          // The data from the new owner is requested in one of these formats, attempted
          // top to bttom.
          const knownMimeTypes = [
            'x-special/gnome-copied-files',
            'image/svg+xml',
            'image/png',
            'text/plain;charset=utf-8',
            'text/plain',
          ];

          // Find a matching mime type.
          let mimeType = '';
          for (let i = 0; i < knownMimeTypes.length; i++) {
            if (owner.get_mimetypes().includes(knownMimeTypes[i])) {
              mimeType = knownMimeTypes[i];
              break;
            }
          }

          // We ignore things we do not know.
          if (mimeType == '') {
            return;
          }

          // A chunk of memory where we will write the clipboard data to.
          const output = Gio.MemoryOutputStream.new_resizable();

          // Attempt to transfer the data in the selected format.
          global.display.get_selection().transfer_async(
              type, mimeType, MAX_DATA_SIZE_MB * 1024 * 1024, output, null,
              (o, result) => {
                // Finish the transfer.
                if (!global.display.get_selection().transfer_finish(result)) {
                  utils.debug('Failed to create clipboard item: Data transfer failed!');
                  return;
                }

                // Close the stream.
                output.close(null);

                // Log an error if the data was apparently larger than we expected.
                if (output.get_data_size() >= MAX_DATA_SIZE_MB * 1024 * 1024) {
                  utils.debug(
                      'Failed to create clipboard item: The clipboard data is too large!');
                  return;
                }

                // Log an error if the data was not transferred successfully.
                if (output.get_data_size() == 0) {
                  utils.debug('Failed to create clipboard item: Got no clipboard data!');
                  return;
                }

                // Create a new item.
                const newItem = {
                  type: mimeType,
                  data: output.steal_as_bytes(),
                };

                // Check whether we have the same item already. If so, we remove it so we
                // do not have duplicated entries..
                for (let i = 0; i < this._items.length; i++) {
                  const item = this._items[i];
                  if (newItem.mimeType == item.mimeType &&
                      item.data.equal(newItem.data)) {

                    this._items.splice(i, 1);

                    // There can be at most one duplicated entry.
                    break;
                  }
                }

                // Add the new item to the list of items.
                const length = this._items.unshift(newItem);

                // Pop the last entry if we have stored more than MAX_ENTRIES of items.
                if (length > MAX_ENTRIES) {
                  this._items.pop();
                }
              });
        });
  }


  // This should not be called directly. Use the static singleton interface above!
  destroy() {
    global.display.get_selection().disconnect(this._clipboardConnection);
  }

  // -------------------------------------------------------------------- public interface

  // Returns a list of recently copied items. You can use the pasteItem() method below to
  // paste the item from the clipboard. Each item contains a "type" (string) and a "data"
  // (ByteArray) property. The first item is the one copied most recently.
  getItems() {
    return this._items;
  }

  // This method pastes the data of an item returned by the getItems() method above.
  pasteItem(item) {

    // Make sure that the clipboard owner change does not modify our list of copied items.
    this.ignoreNextOwnerChange();

    // Provide the data on the clipboard.
    global.display.get_selection().set_owner(
        Meta.SelectionType.SELECTION_CLIPBOARD,
        Meta.SelectionSourceMemory.new(item.type, item.data));

    // Finally, simulate Ctrl+V.
    this._input.activateAccelerator('<Primary>v');
  }

  // If we mess with the clipboard from within Fly-Pie, we can use this to prevent the
  // next owner change from creating an item.
  ignoreNextOwnerChange() {
    this._ignoreNextOwnerChange = true;
  }
}
