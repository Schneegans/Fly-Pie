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
//////////////////////////////////////////////////////////////////////////////////////////

// This class is supposed to be used as singleton. This global variable stores the
// singleton instance.
let _instance          = null;
const MAX_ENTRIES      = 20;
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

    this._input = new InputManipulator();

    this._ignoreNextOwnerChange = false;

    this._items = [];

    this._clipboardConnection =
        global.display.get_selection().connect('owner-changed', (s, type, source) => {
          if (type != Meta.SelectionType.SELECTION_CLIPBOARD) {
            return;
          }

          if (this._ignoreNextOwnerChange) {
            this._ignoreNextOwnerChange = false;
            return;
          }

          const knownMimeTypes = [
            'text/uri-list',
            'image/svg+xml',
            'image/png',
            'text/plain;charset=utf-8',
            'text/plain',
          ];

          let mimeType = '';

          for (let i = 0; i < knownMimeTypes.length; i++) {
            if (source.get_mimetypes().includes(knownMimeTypes[i])) {
              mimeType = knownMimeTypes[i];
              break;
            }
          }

          if (mimeType == '') {
            return;
          }

          const output = Gio.MemoryOutputStream.new_resizable();
          global.display.get_selection().transfer_async(
              type, mimeType, MAX_DATA_SIZE_MB * 1024 * 1024, output, null, () => {
                if (output.get_data_size() >= MAX_DATA_SIZE_MB * 1024 * 1024) {
                  utils.debug(
                      'Failed to create clipboard item: The clipboard data is too large!');
                  return;
                }

                output.close(null);

                const length = this._items.unshift({
                  type: mimeType,
                  data: output.steal_as_bytes(),
                });

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

  getItems() {
    return this._items;
  }

  pasteItem(item) {
    this._ignoreNextOwnerChange = true;
    const source                = Meta.SelectionSourceMemory.new(item.type, item.data);
    global.display.get_selection().set_owner(
        Meta.SelectionType.SELECTION_CLIPBOARD, source);

    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
      this._input.activateAccelerator('Paste');
      return false;
    });
  }


  // ----------------------------------------------------------------------- private stuff
}
