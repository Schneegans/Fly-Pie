//////////////////////////////////////////////////////////////////////////////////////////
//                                                                                      //
//    _____                    ___  _     ___       This software may be modified       //
//   / ___/__  ___  __ _  ___ / _ \(_)__ |_  |      and distributed under the           //
//  / (_ / _ \/ _ \/  ' \/ -_) ___/ / -_) __/       terms of the MIT license. See       //
//  \___/_//_/\___/_/_/_/\__/_/  /_/\__/____/       the LICENSE file for details.       //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

const St             = imports.gi.St;
const Gtk            = imports.gi.Gtk;
const Clutter        = imports.gi.Clutter;
const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();

const debug = Me.imports.debug.debug;

function getIconColor(icon) {
  let theme = Gtk.IconTheme.get_default();
  let info  = theme.lookup_by_gicon(icon, 24, Gtk.IconLookupFlags.FORCE_SIZE);

  if (info == null) {
    debug("Failed to find icon " + icon.to_string() + "! Using default...");
    info = theme.lookup_icon("image-missing", 24, Gtk.IconLookupFlags.FORCE_SIZE);

    if (info == null) {
      debug("Failed to find default icon!");
      return new Clutter.Color({red : 255, green : 255, blue : 255, alpha : 255});
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
    red : rTotal / total * 255,
    green : gTotal / total * 255,
    blue : bTotal / total * 255,
    alpha : 255
  });
}
