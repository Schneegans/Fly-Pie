//////////////////////////////////////////////////////////////////////////////////////////
//                                                                                      //
//    _____                    ___  _     ___       This software may be modified       //
//   / ___/__  ___  __ _  ___ / _ \(_)__ |_  |      and distributed under the           //
//  / (_ / _ \/ _ \/  ' \/ -_) ___/ / -_) __/       terms of the MIT license. See       //
//  \___/_//_/\___/_/_/_/\__/_/  /_/\__/____/       the LICENSE file for details.       //
//                                                                                      //
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

function notification(message) {
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
// This returns a square-shaped Cairo.ImageSurface of the given size containing an      //
// icon. The name can either be an icon name from the current icon theme or a path to   //
// an image file. If neither is found, the given name is written to the image - This is //
// very useful for emojis like 😆 or 🌟!                                                //
//////////////////////////////////////////////////////////////////////////////////////////

function getIcon(name, size) {

  // First try to find the icon in the theme. This will also load images from disc if the
  // icon name is actually a file path.
  let theme = Gtk.IconTheme.get_default();
  let info  = theme.lookup_by_gicon(
      Gio.Icon.new_for_string(name), size, Gtk.IconLookupFlags.FORCE_SIZE);

  // We got something, return it!
  if (info != null) {
    return info.load_surface(null);
  }

  // If no icon was found, write it as plain text.
  let surface = new Cairo.ImageSurface(Cairo.Format.ARGB32, size, size);
  let ctx     = new Cairo.Context(surface);

  ctx.setSourceRGBA(0, 0, 0, 1);

  let layout = PangoCairo.create_layout(ctx);
  layout.set_width(Pango.units_from_double(size));

  let font_description = Pango.FontDescription.from_string('Sans');
  font_description.set_absolute_size(Pango.units_from_double(size * 0.9));

  layout.set_font_description(font_description);
  layout.set_text(name, -1);
  layout.set_alignment(Pango.Alignment.CENTER);

  let extents = layout.get_pixel_extents()[1];
  ctx.moveTo(0, (size - extents.height) / 2);

  PangoCairo.update_layout(ctx, layout);
  PangoCairo.show_layout(ctx, layout);

  return surface;
}


//////////////////////////////////////////////////////////////////////////////////////////
// Returns a representative average Clutter.Color for a given Cairo.Surface. The alpha  //
// can be passed as parameter. The saturation and the luminance (both in range [0, 1])  //
// can be used to tweak the resulting saturation and luminance values.                  //
// This is based on code from the original Gnome-Pie.                                   //
//////////////////////////////////////////////////////////////////////////////////////////

function getAverageIconColor(iconSurface, iconSize, saturation, luminance, alpha) {

  // surface.get_data() as well as surface.get_width() are not available somehow. Therefor
  // we have to pass in the icon size and use the pixbuf conversion below.
  let pixbuf = Gdk.pixbuf_get_from_surface(iconSurface, 0, 0, iconSize, iconSize);
  let pixels = pixbuf.get_pixels();
  let count  = pixels.length;

  let total = 0, rTotal = 0, gTotal = 0, bTotal = 0;

  for (let i = 0; i < count; i += 4) {
    let r = pixels[i + 0] / 255;
    let g = pixels[i + 1] / 255;
    let b = pixels[i + 2] / 255;
    let a = pixels[i + 3] / 255;

    // Put mor weight on non-transparent and more saturated colors.
    let saturation = Math.max(r, Math.max(g, b)) - Math.min(r, Math.min(g, b));
    let relevance  = 0.1 + 0.9 * a * saturation;

    rTotal += r * relevance;
    gTotal += g * relevance;
    bTotal += b * relevance;

    total += relevance;
  }

  // Create a Clutter.Color based on the calculated values.
  let color = new Clutter.Color({
    red: rTotal / total * 255,
    green: gTotal / total * 255,
    blue: bTotal / total * 255
  });

  let [h, l, s] = color.to_hls();

  // Now we modify this color based on luminance and saturation. First we
  // increase the base luminance to 0.5 so that we do not create pitch black colors.
  l = 0.5 + l * 0.5;

  let lFac = luminance * 2 - 1;
  l        = lFac > 0 ? l * (1 - lFac) + 1 * lFac : l * (lFac + 1);

  // We only modify the saturation if it's not too low. Else we will get artificial colors
  // for already quite desaturated icons.
  if (s > 0.1) {
    let sFac = saturation * 2 - 1;
    s        = sFac > 0 ? s * (1 - sFac) + 1 * sFac : s * (sFac + 1);
  }

  color       = Clutter.Color.from_hls(h, l, s);
  color.alpha = alpha;

  return color;
}

//////////////////////////////////////////////////////////////////////////////////////////
// A simple convenience method to convert a string to a Gdk.RGBA                        //
//////////////////////////////////////////////////////////////////////////////////////////

function stringToRGBA(string) {
  let rgba = new Gdk.RGBA();
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
