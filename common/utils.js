//////////////////////////////////////////////////////////////////////////////////////////
//                                                                                      //
//    _____                    ___  _     ___       This software may be modified       //
//   / ___/__  ___  __ _  ___ / _ \(_)__ |_  |      and distributed under the           //
//  / (_ / _ \/ _ \/  ' \/ -_) ___/ / -_) __/       terms of the MIT license. See       //
//  \___/_//_/\___/_/_/_/\__/_/  /_/\__/____/       the LICENSE file for details.       //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const {Gtk, Gio, Clutter, GLib} = imports.gi;

const Me = imports.misc.extensionUtils.getCurrentExtension();

//////////////////////////////////////////////////////////////////////////////////////////
// This method can be used to write a message to Gnome-Shell's log. This is enhances    //
// the standard log() functionality by prepending the extensions name and the location  //
// where the message was logged. As the extensions name is part of the location, you    //
// can more effectively watch the log output of Gnome-Shell:                            //
// journalctl /usr/bin/gnome-shell -f -o cat | grep gnomepie -B 2 -A 2                  //
//////////////////////////////////////////////////////////////////////////////////////////

function debug(message) {
  let stack = new Error().stack.split('\n');

  // Remove debug() function call from stack.
  stack.shift();

  // Find the index of the extension directory (e.g. gnomepie2@code.simonschneegans.de) in
  // the stack entry. We do not want to print the entire absolute file path.
  let extensionRoot = stack[0].indexOf(Me.metadata.uuid);

  log('[' + stack[0].slice(extensionRoot) + '] ' + message);
}

//////////////////////////////////////////////////////////////////////////////////////////
// Especially the code in prefs.js is hard to debug, as the information is nowhere to   //
// be found. This method can be used to get at least some idea what is going on...      //
//////////////////////////////////////////////////////////////////////////////////////////

function printNotification(message) {
  GLib.spawn_async(
      null, ['/usr/bin/notify-send', '-u', 'low', 'Gnome-Pie 2', message], null,
      GLib.SpawnFlags.DO_NOT_REAP_CHILD, null);
}

//////////////////////////////////////////////////////////////////////////////////////////
// Creates a new Gio.Settings object for org.gnome.shell.extensions.gnomepie2 and       //
// returns it.                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////

function createSettings() {
  let schema = Gio.SettingsSchemaSource.new_from_directory(
      Me.dir.get_child('schemas').get_path(), Gio.SettingsSchemaSource.get_default(),
      false);

  return new Gio.Settings(
      {settings_schema: schema.lookup('org.gnome.shell.extensions.gnomepie2', true)});
}

//////////////////////////////////////////////////////////////////////////////////////////
// This can be used to print all properties of an object. Can be helpful if             //
// documentation is sparse or outdated...                                               //
//////////////////////////////////////////////////////////////////////////////////////////

function logProperties(object) {
  for (let element in object) {
    debug(`${element} [${typeof (object[element])}]`);
  }
}


//////////////////////////////////////////////////////////////////////////////////////////
// Returns a representative average Clutter.Color for a given Gio.Icon. The alpha value //
// will always be 255. This is based on code from the original Gnome-Pie.               //
//////////////////////////////////////////////////////////////////////////////////////////

function getIconColor(icon) {
  let theme = Gtk.IconTheme.get_default();
  let info  = theme.lookup_by_gicon(icon, 24, Gtk.IconLookupFlags.FORCE_SIZE);

  if (info == null) {
    debug('Failed to find icon ' + icon.to_string() + '! Using default...');
    info = theme.lookup_icon('image-missing', 24, Gtk.IconLookupFlags.FORCE_SIZE);

    if (info == null) {
      debug('Failed to find default icon!');
      return new Clutter.Color({red: 255, green: 255, blue: 255, alpha: 255});
    }
  }

  let pixbuf = info.load_icon();
  let pixels = pixbuf.get_pixels();
  let count  = pixels.length;

  let total = 0, rTotal = 0, gTotal = 0, bTotal = 0;

  for (let i = 0; i < count; i += 4) {
    let r = pixels[i + 0] / 255;
    let g = pixels[i + 1] / 255;
    let b = pixels[i + 2] / 255;
    let a = pixels[i + 3] / 255;

    let saturation = Math.max(r, Math.max(g, b)) - Math.min(r, Math.min(g, b));
    let relevance  = 0.1 + 0.9 * a * saturation;

    rTotal += r * relevance;
    gTotal += g * relevance;
    bTotal += b * relevance;

    total += relevance;
  }

  return new Clutter.Color({
    red: rTotal / total * 255,
    green: gTotal / total * 255,
    blue: bTotal / total * 255,
    alpha: 255
  });
}

//////////////////////////////////////////////////////////////////////////////////////////
// This rounds the given number to the nearest multiple of base. This works for integer //
// and floating point values and both for positive and negative numbers.                //
//////////////////////////////////////////////////////////////////////////////////////////

function roundToMultiple(number, base) {
  return ((number % base) > base / 2) ? number + base - number % base :
                                        number - number % base;
}
