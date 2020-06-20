//////////////////////////////////////////////////////////////////////////////////////////
//   _____       _             _____ _                                                  //
//  |   __|_ _ _|_|___ ___ ___|  _  |_|___   This software may be modified and distri-  //
//  |__   | | | | |   | . |___|   __| | -_|  buted under the terms of the MIT license.  //
//  |_____|_____|_|_|_|_  |   |__|  |_|___|  See the LICENSE file for details.          //
//                    |___|                                                             //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Cairo                                             = imports.cairo;
const {Gdk, Gtk, Gio, Pango, PangoCairo, Clutter, GLib} = imports.gi;

const Me = imports.misc.extensionUtils.getCurrentExtension();


//////////////////////////////////////////////////////////////////////////////////////////
// This method can be used to write a message to Gnome-Shell's log. This is enhances    //
// the standard log() functionality by prepending the extensions name and the location  //
// where the message was logged. As the extensions name is part of the location, you    //
// can more effectively watch the log output of Gnome-Shell:                            //
// journalctl /usr/bin/gnome-shell -f -o cat | grep swingpie -B 2 -A 2                  //
//////////////////////////////////////////////////////////////////////////////////////////

function debug(message) {
  const stack = new Error().stack.split('\n');

  // Remove debug() function call from stack.
  stack.shift();

  // Find the index of the extension directory (e.g. swingpie@code.simonschneegans.de) in
  // the stack entry. We do not want to print the entire absolute file path.
  const extensionRoot = stack[0].indexOf(Me.metadata.uuid);

  log('[' + stack[0].slice(extensionRoot) + '] ' + message);
}


//////////////////////////////////////////////////////////////////////////////////////////
// Especially the code in prefs.js is hard to debug, as the information is nowhere to   //
// be found. This method can be used to get at least some idea what is going on...      //
//////////////////////////////////////////////////////////////////////////////////////////

function notification(message) {
  GLib.spawn_async(
      null, ['/usr/bin/notify-send', '-u', 'low', 'Swing-Pie', message], null,
      GLib.SpawnFlags.DO_NOT_REAP_CHILD, null);
}


//////////////////////////////////////////////////////////////////////////////////////////
// Creates a new Gio.Settings object for org.gnome.shell.extensions.swingpie and       //
// returns it.                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////

function createSettings() {
  const schema = Gio.SettingsSchemaSource.new_from_directory(
      Me.dir.get_child('schemas').get_path(), Gio.SettingsSchemaSource.get_default(),
      false);

  return new Gio.Settings(
      {settings_schema: schema.lookup('org.gnome.shell.extensions.swingpie', true)});
}


//////////////////////////////////////////////////////////////////////////////////////////
// This can be used to print all properties of an object. Can be helpful if             //
// documentation is sparse or outdated...                                               //
//////////////////////////////////////////////////////////////////////////////////////////

function logProperties(object) {
  for (const element in object) {
    debug(`${element} [${typeof (object[element])}]`);
  }
}


//////////////////////////////////////////////////////////////////////////////////////////
// This draws a square-shaped icon to the given Cairo.Context of the given size.        //
// The name can either be an icon name from the current icon theme or a path to         //
// an image file. If neither is found, the given name is written to the image - This is //
// very useful for emojis like 😆 or 🌟!                                                 //
//////////////////////////////////////////////////////////////////////////////////////////

function paintIcon(ctx, name, size, opacity) {

  // First try to find the icon in the theme. This will also load images from disc if the
  // icon name is actually a file path.
  const theme = Gtk.IconTheme.get_default();
  const info  = theme.lookup_by_gicon(
      Gio.Icon.new_for_string(name), size, Gtk.IconLookupFlags.FORCE_SIZE);

  // We got something, return it!
  if (info != null) {
    Gdk.cairo_set_source_pixbuf(ctx, info.load_icon(), 0, 0);
    ctx.paintWithAlpha(opacity);

  } else {

    // If no icon was found, write it as plain text.
    ctx.setSourceRGBA(0, 0, 0, opacity);

    const layout = PangoCairo.create_layout(ctx);
    layout.set_width(Pango.units_from_double(size));

    const fontDescription = Pango.FontDescription.from_string('Sans');
    fontDescription.set_absolute_size(Pango.units_from_double(size * 0.9));

    layout.set_font_description(fontDescription);
    layout.set_text(name, -1);
    layout.set_alignment(Pango.Alignment.CENTER);

    const extents = layout.get_pixel_extents()[1];
    ctx.moveTo(0, (size - extents.height) / 2);

    ctx.pushGroup();
    PangoCairo.update_layout(ctx, layout);
    PangoCairo.show_layout(ctx, layout);
    ctx.popGroupToSource();
    ctx.paintWithAlpha(opacity);
  }
}


//////////////////////////////////////////////////////////////////////////////////////////
// Returns a representative average Clutter.Color for a given Cairo.Surface.            //
// This is based on code from the original Gnome-Pie.                                   //
//////////////////////////////////////////////////////////////////////////////////////////

function getAverageIconColor(iconSurface, iconSize) {

  // surface.get_data() as well as surface.get_width() are not available somehow. Therefor
  // we have to pass in the icon size and use the pixbuf conversion below.
  const pixbuf = Gdk.pixbuf_get_from_surface(iconSurface, 0, 0, iconSize, iconSize);
  const pixels = pixbuf.get_pixels();
  const count  = pixels.length;

  let total = 0, rTotal = 0, gTotal = 0, bTotal = 0;

  for (let i = 0; i < count; i += 4) {
    const r = pixels[i + 0] / 255;
    const g = pixels[i + 1] / 255;
    const b = pixels[i + 2] / 255;
    const a = pixels[i + 3] / 255;

    // Put mor weight on non-transparent and more saturated colors.
    const saturation = Math.max(r, Math.max(g, b)) - Math.min(r, Math.min(g, b));
    const relevance  = 0.1 + 0.9 * a * saturation;

    rTotal += r * relevance;
    gTotal += g * relevance;
    bTotal += b * relevance;

    total += relevance;
  }

  // Create a Clutter.Color based on the calculated values.
  return new Clutter.Color({
    red: rTotal / total * 255,
    green: gTotal / total * 255,
    blue: bTotal / total * 255
  });
}

//////////////////////////////////////////////////////////////////////////////////////////
// A simple convenience method to convert a string to a Gdk.RGBA                        //
//////////////////////////////////////////////////////////////////////////////////////////

function stringToRGBA(string) {
  const rgba = new Gdk.RGBA();
  rgba.parse(string);
  return rgba;
}


//////////////////////////////////////////////////////////////////////////////////////////
// This rounds the given number to the nearest multiple of base. This works for integer //
// and floating point values and both for positive and negative numbers.                //
//////////////////////////////////////////////////////////////////////////////////////////

function roundToMultiple(number, base) {
  return ((number % base) > base / 2) ? number + base - number % base :
                                        number - number % base;
}
