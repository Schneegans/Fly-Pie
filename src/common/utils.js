//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Cairo                                               = imports.cairo;
const {GLib, Gdk, Gtk, Gio, Pango, PangoCairo, GdkPixbuf} = imports.gi;

// We import the St module optionally. When this file is included from the daemon
// side, it is available and can be used below. If this file is included via the pref.js,
// it will not be available.
let St = undefined;

try {
  St = imports.gi.St;
} catch (error) {
  // Nothing to be done, we're in settings-mode.
}

const Me = imports.misc.extensionUtils.getCurrentExtension();


//////////////////////////////////////////////////////////////////////////////////////////
// This method can be used to write a message to GNOME Shell's log. This is enhances    //
// the standard log() functionality by prepending the extension's name and the location //
// where the message was logged. As the extensions name is part of the location, you    //
// can more effectively watch the log output of GNOME Shell:                            //
// journalctl -f -o cat | grep -E 'flypie|'                                             //
//////////////////////////////////////////////////////////////////////////////////////////

function debug(message) {
  const stack = new Error().stack.split('\n');

  // Remove debug() function call from stack.
  stack.shift();

  // Find the index of the extension directory (e.g. flypie@schneegans.github.com) in
  // the stack entry. We do not want to print the entire absolute file path.
  const extensionRoot = stack[0].indexOf(Me.metadata.uuid);

  log('[' + stack[0].slice(extensionRoot) + '] ' + message);
}


//////////////////////////////////////////////////////////////////////////////////////////
// Creates a new Gio.Settings object for org.gnome.shell.extensions.flypie and          //
// returns it.                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////

function createSettings() {
  const schema = Gio.SettingsSchemaSource.new_from_directory(
      Me.dir.get_child('schemas').get_path(), Gio.SettingsSchemaSource.get_default(),
      false);

  return new Gio.Settings(
      {settings_schema: schema.lookup('org.gnome.shell.extensions.flypie', true)});
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
// Returns the current session type, e.g. "wayland" or "x11".                           //
//////////////////////////////////////////////////////////////////////////////////////////

let _sessionType = null;
function getSessionType() {
  if (_sessionType == null) {
    _sessionType = GLib.getenv('XDG_SESSION_TYPE');
  }
  return _sessionType;
}

//////////////////////////////////////////////////////////////////////////////////////////
// Due to this issue https://gitlab.gnome.org/GNOME/mutter/-/issues/960, the static     //
// function Gtk.IconTheme.get_for_display() may return null when executed from the      //
// gnome-shell process of Wayland. In this case, we use St to get a valid icon theme.   //
//////////////////////////////////////////////////////////////////////////////////////////

let _iconTheme = null;
function getIconTheme() {

  if (_iconTheme == null) {

    // If St is available (that means we are in the gnome-shell process), we attempt to
    // get the theme from St. Else we use the X11-dependent Gtk code.
    if (St) {
      _iconTheme = new Gtk.IconTheme();
      _iconTheme.set_custom_theme(St.Settings.get().gtk_icon_theme);
    } else {
      if (gtk4()) {
        _iconTheme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default());
      } else {
        _iconTheme = Gtk.IconTheme.get_default();
      }
    }

    // Print an error if this fails as well.
    if (_iconTheme == null) {
      debug('Failed to get a valid icon theme object!');
    }

    // Make sure that the icons under resources/img are available as system icons.
    _iconTheme.add_resource_path('/img');
  }

  return _iconTheme;
}

//////////////////////////////////////////////////////////////////////////////////////////
// The methods below are helper methods which can be used on either GTK3 or GTK4. They  //
// all check internally whether we are currently using GTK3 or GTK4 and call the        //
// respective method.                                                                   //
//////////////////////////////////////////////////////////////////////////////////////////

// This method simply returns true if we are currently using GTK4.
function gtk4() {
  return Gtk.get_major_version() == 4;
}

// Adds the given css class to the given widget.
function addCSSClass(widget, klass) {
  if (gtk4()) {
    widget.add_css_class(klass);
  } else {
    widget.get_style_context().add_class(klass);
  }
}

// Removes all children from the given widget.
function clearChildren(container) {
  if (gtk4()) {
    while (container.get_first_child() != null) {
      container.remove(container.get_first_child());
    }
  } else {
    container.foreach(w => container.remove(w));
  }
}

// Appends the given child widget to the given Gtk.Box.
function boxAppend(box, child, expand = false, fill = false) {
  if (gtk4()) {
    box.append(child);
  } else {
    box.pack_start(child, expand, fill, 0);
  }
}

// Appends the given child to the given one-child container. This could be a Gtk.Button
// for example. Or a Gtk.Revealer.
function setChild(widget, child) {
  if (gtk4()) {
    widget.set_child(child);
  } else {
    clearChildren(widget);
    widget.add(child);
  }
}

// Calls size_allocate() with the given allocation on the given widget.
function sizeAllocate(widget, allocation) {
  if (gtk4()) {
    widget.size_allocate(allocation, -1);
  } else {
    widget.size_allocate(allocation);
  }
}

// Sets the drawing function of the given Gtk.DrawingArea.
function setDrawFunc(drawingArea, func) {
  if (gtk4()) {
    drawingArea.set_draw_func(func);
  } else {
    drawingArea.connect('draw', func);
  }
}

// Returns the foreground color of the given widget.
function getColor(widget) {
  if (gtk4()) {
    return widget.get_style_context().get_color();
  }

  return widget.get_style_context().get_color(Gtk.StateFlags.NORMAL);
}

// Returns the toplevel parent widget.
function getRoot(widget) {
  if (gtk4()) {
    return widget.get_root();
  }

  return widget.get_toplevel();
}

//////////////////////////////////////////////////////////////////////////////////////////
// This draws a square-shaped icon to the given Cairo.Context of the given size. The    //
// name can either be an icon name from the current icon theme, a path to an image      //
// file, or a base64 encoded image. If none of this is given, the icon name is written  //
// to the image. The given font (like 'Sans') and textColor (an object with properties  //
// 'red', 'green' and 'blue' inthe range 0..1) are used in this case. This is very      //
// useful for emojis like 😆 or 🌟! Symbolic icons are colored by the given textColor   //
// as well.                                                                             //
// To make things fancy, there is the possibility to create circle-shaped icons based   //
// on symbolic icons: If the icon name references an existing symbolic icon, you can    //
// append -#rrggbb to the icon name! A circle of this color will be drawn below the     //
// icon.                                                                                //
//////////////////////////////////////////////////////////////////////////////////////////

let _iconDecor = null;
function paintIcon(ctx, name, size, opacity, font, textColor) {

  // In this case, we will not draw anything...
  if (size <= 0) {
    return;
  }

  // Further below, test whether there is a -#rrggbb suffix appended to the icon name. If
  // so, we draw a circle with this color (stored in iconBackgroundColor) below the icon.
  // We will also use a hard-coded bright color for text-icons in this case.
  let iconName            = name;
  let iconBackgroundColor = null;
  let iconColor           = textColor;

  // We test whether there is a -#rrggbb suffix appended to the icon name.
  {
    const iconNameComponents = name.split('-#');

    if (iconNameComponents.length >= 2) {
      const color = new Gdk.RGBA();
      const valid = color.parse('#' + iconNameComponents[iconNameComponents.length - 1]);

      if (valid) {
        iconName            = iconName.slice(0, iconName.lastIndexOf('-'));
        iconBackgroundColor = color;
        iconColor           = new Gdk.RGBA({red: 230, green: 230, blue: 230, alpha: 1.0});
      }
    }
  }

  // We draw to a group to be able to paint the complete icon with opacity.
  ctx.pushGroup();

  // Draw a colored background circle if a -#rrggbb color was part of the icon name.
  if (iconBackgroundColor) {

    // Draw the background circle.
    ctx.save()
    ctx.setSourceRGBA(
        iconBackgroundColor.red, iconBackgroundColor.green, iconBackgroundColor.blue,
        iconBackgroundColor.alpha);
    ctx.translate(size / 2, size / 2);
    ctx.arc(0, 0, size * 30 / 64, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();

    // This contains some slight shadow to provide a bit of depth.
    if (!_iconDecor) {
      _iconDecor = GdkPixbuf.Pixbuf.new_from_resource('/img/symbolic-icon-decor.svg');
    }

    ctx.save()
    ctx.scale(size / _iconDecor.get_width(), size / _iconDecor.get_height());
    Gdk.cairo_set_source_pixbuf(ctx, _iconDecor, 0, 0);
    ctx.paint();
    ctx.restore();

    // The actual icon is drawn smaller when there is a background.
    const scale = 1.6;
    ctx.translate(size / 2, size / 2);
    ctx.scale(1 / scale, 1 / scale);
    ctx.translate(-size / 2, -size / 2);
  }

  // Here we check whether the given icon name is actually a base64 encode image.
  try {

    // If that is the case, the icon name should be something like this:
    // data:image/svg+xml;base64,<...... base64 data ........>
    // So we look for this 'data:image' beginning.
    if (iconName.startsWith('data:image')) {

      // Extract the mime type and the actual base64 data.
      const mimeType = iconName.slice(5, iconName.indexOf(';'));
      const data     = GLib.base64_decode(iconName.slice(iconName.indexOf(',') + 1));

      if (data.length == 0) {
        throw 'Base64 image data was empty!';
      }

      // Try to load the image data. This may throw an error.
      const loader = GdkPixbuf.PixbufLoader.new_with_mime_type(mimeType);
      loader.set_size(size, size);
      loader.write(data);
      loader.close();

      const pixbuf = loader.get_pixbuf();

      // If we got a valid pixbuf, paint it!
      if (pixbuf && pixbuf.get_width() > 0 && pixbuf.get_height() > 0) {
        Gdk.cairo_set_source_pixbuf(ctx, pixbuf, 0, 0);
        ctx.paint();

        ctx.popGroupToSource();
        ctx.paintWithAlpha(opacity);

        return;
      }

      throw 'Unknown error.';
    }
  } catch (error) {
    debug('Failed to draw base64 image: ' + error);
    iconName = 'flypie-image-symbolic';
  }

  // First try to find the icon in the theme. This will also load images from disc if the
  // icon name is actually a file path.
  try {

    // Get an icon theme object. How this is done, depends on the Gtk version and whether
    // we are in GNOME Shell's process.
    const theme = getIconTheme();
    const gicon = Gio.Icon.new_for_string(iconName);
    let pixbuf  = null;

    if (gtk4()) {

      if (theme.has_gicon(gicon)) {

        // Getting a pixbuf from an icon on GTK is a bit involved.
        const paintable = theme.lookup_by_gicon(
            gicon, size, 1, Gtk.TextDirection.NONE, Gtk.IconLookupFlags.FORCE_SIZE);

        if (paintable && paintable.get_file() != null) {

          if (paintable.get_file().get_uri_scheme() == 'resource') {

            // Remove the resource:/// part.
            const res = paintable.get_file().get_uri().slice(11);
            pixbuf = GdkPixbuf.Pixbuf.new_from_resource_at_scale(res, size, size, false);

          } else if (paintable.get_file().get_uri_scheme() == 'file') {

            pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_size(
                paintable.get_file().get_path(), size, size);
          }
        }
      }

    } else {

      // To get a pixbuf from an icon is quite simple on GTK3.
      const info = theme.lookup_by_gicon(gicon, size, Gtk.IconLookupFlags.FORCE_SIZE);

      if (info != null) {
        pixbuf = info.load_icon();
      }
    }

    // We got something, paint it!
    if (pixbuf) {

      Gdk.cairo_set_source_pixbuf(ctx, pixbuf, 0, 0);

      // If it's a symbolic icon, we draw it with the provided text color.
      if (iconName.includes('-symbolic')) {
        const pattern = ctx.getSource();

        // Draw a slight shadow below the icon.
        if (iconBackgroundColor) {
          ctx.setSourceRGBA(0, 0, 0, 0.25);
          ctx.translate(2, 2);
          ctx.mask(pattern);
          ctx.translate(-2, -2);
        }

        ctx.setSourceRGBA(iconColor.red, iconColor.green, iconColor.blue, 1.0);

        ctx.mask(pattern);
      } else {
        ctx.paint();
      }

      ctx.popGroupToSource();
      ctx.paintWithAlpha(opacity);

      return;
    }

  } catch (error) {
    debug('Failed to draw icon \'' + name + '\': ' + error + '! Falling back to text...');
  }

  // If no icon was found, write it as plain text. We use a hard-coded font size of 12
  // here. This doesn't really matter as the text of the icon is scaled so that it covers
  // the entire icon anyways. So in theory any number should result in the same icon.
  // However, for some reason there are slight offsets in the text position with different
  // font sizes. With a font size of 12, emojis are centered quite well. With 11, they are
  // slightly shifted towards the right, for example.
  const fontDescription = Pango.FontDescription.from_string(font);
  fontDescription.set_size(Pango.units_from_double(12));

  const layout = PangoCairo.create_layout(ctx);
  layout.set_font_description(fontDescription);
  layout.set_alignment(Pango.Alignment.CENTER);
  layout.set_wrap(Pango.WrapMode.CHAR);
  layout.set_text(iconName, -1);

  // We created a one-line layout above. We now estimate a proper width for the layout so
  // that the text covers more ore less a square shaped region. For this we compute the
  // required surface area of the one-line layout and compute the size of a equally large
  // square. As this will underestimate the required width slightly, we add the line's
  // height as additional width. This works quite well in most cases.
  const lineExtents = layout.get_pixel_extents()[1];
  const squareSize  = Math.sqrt(Math.max(1, lineExtents.width * lineExtents.height));
  layout.set_width(Pango.units_from_double(squareSize + lineExtents.height));

  // Now we retrieve the new extents and make sure that the new layout is centered in our
  // icon. We limit the overall scale to 100, as really huge font sizes sometime seem to
  // break pango.
  const extents   = layout.get_pixel_extents()[1];
  const maxExtent = Math.max(extents.width, extents.height);
  const scale     = Math.min(100, size / maxExtent);

  ctx.setSourceRGBA(iconColor.red, iconColor.green, iconColor.blue, opacity);
  ctx.scale(scale, scale);
  ctx.translate(-extents.x, -extents.y);
  ctx.translate((maxExtent - extents.width) / 2, (maxExtent - extents.height) / 2);

  PangoCairo.update_layout(ctx, layout);
  PangoCairo.show_layout(ctx, layout);

  ctx.popGroupToSource();
  ctx.paintWithAlpha(opacity);
}

//////////////////////////////////////////////////////////////////////////////////////////
// This creates a new square-shaped Cairo.ImageSurface of the given size and draws an   //
// icon to it. See the documentation of paintIcon() above for an explanation what could //
// be used for icon names.                                                              //
//////////////////////////////////////////////////////////////////////////////////////////

function createIcon(name, size, font, textColor) {
  const surface = new Cairo.ImageSurface(Cairo.Format.ARGB32, size, size);
  const ctx     = new Cairo.Context(surface);
  paintIcon(ctx, name, size, 1, font, textColor);

  // Explicitly tell Cairo to free the context memory. Is this really necessary?
  // https://wiki.gnome.org/Projects/GnomeShell/Extensions/TipsOnMemoryManagement#Cairo
  ctx.$dispose();

  return surface;
}

//////////////////////////////////////////////////////////////////////////////////////////
// Returns an [r, g, b], with each element [0...255] representing an average color for  //
// a given Cairo.Surface. This is based on code from Gnome-Pie.                         //
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

  // Create an array based on the calculated values.
  return [rTotal / total * 255, gTotal / total * 255, bTotal / total * 255];
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


//////////////////////////////////////////////////////////////////////////////////////////
// This method receives an array of objects, each representing an item in a menu level. //
// For each item it computes an angle defining the direction in which the item should   //
// be rendered. The angles are returned in an array (of the same length as the input    //
// array). If an item in the input array already has an 'angle' property, this is       //
// considered a fixed angle and all others are distributed more ore less evenly around. //
// This method also reserves the required angular space for the back navigation link to //
// the parent item (if given). Angles in items are always in degrees, 0° is on the top, //
// 90° on the right, 180° on the bottom and so on. This method may return null if for   //
// some reason the angles could not be computed. For instance, this would be the case   //
// if the fixed angles are not monotonically increasing.                                //
//////////////////////////////////////////////////////////////////////////////////////////

function computeItemAngles(items, parentAngle) {

  const itemAngles = [];

  // Shouldn't happen, but who knows...
  if (items.length == 0) {
    return itemAngles;
  }

  // We begin by storing all fixed angles.
  const fixedAngles = [];
  items.forEach((item, index) => {
    if ('angle' in item && item.angle >= 0) {
      fixedAngles.push({angle: item.angle, index: index});
    }
  });

  // Make sure that the parent link does not collide with a fixed item. For now, we
  // just move the fixed angle a tiny bit. This is somewhat error-prone as it may
  // collide with another fixed angle now. Maybe this could be solved in a better way?
  // Maybe some global minimum angular spacing of items?
  if (parentAngle != undefined) {
    for (let i = 0; i < fixedAngles.length; i++) {
      if (Math.abs(fixedAngles[i].angle - parentAngle) < 0.0001) {
        fixedAngles[i].angle += 0.1;
      }
    }
  }

  // Make sure that the fixed angles are between 0° and 360°.
  for (let i = 0; i < fixedAngles.length; i++) {
    fixedAngles[i].angle = fixedAngles[i].angle % 360;
  }

  // Make sure that the fixed angles increase monotonically. If a fixed angle is larger
  // than the next one, the next one will be ignored.
  for (let i = 0; i < fixedAngles.length - 1;) {
    if (fixedAngles[i].angle > fixedAngles[i + 1].angle) {
      fixedAngles.splice(i + 1, 1);
    } else {
      ++i;
    }
  }

  // If no item has a fixed angle, we assign one to the first item. If there is no
  // parent item, this is on the top (0°). Else, the angular space will be evenly
  // distributed to all child items and the first item will be the one closest to the
  // top.
  if (fixedAngles.length == 0) {
    let firstAngle = 0;
    if (parentAngle != undefined) {
      const wedgeSize  = 360 / (items.length + 1);
      let minAngleDiff = 360;
      for (let i = 0; i < items.length; i++) {
        const angle     = (parentAngle + (i + 1) * wedgeSize) % 360;
        const angleDiff = Math.min(angle, 360 - angle);

        if (angleDiff < minAngleDiff) {
          minAngleDiff = angleDiff;
          firstAngle   = (angle + 360) % 360;
        }
      }
    }
    fixedAngles.push({angle: firstAngle, index: 0});
    itemAngles[0] = firstAngle;
  }

  // Now we iterate through the fixed angles, always considering wedges between
  // consecutive pairs of fixed angles. If there is only one fixed angle, there is also
  // only one 360°-wedge.
  for (let i = 0; i < fixedAngles.length; i++) {
    let wedgeBeginIndex = fixedAngles[i].index;
    let wedgeBeginAngle = fixedAngles[i].angle;
    let wedgeEndIndex   = fixedAngles[(i + 1) % fixedAngles.length].index;
    let wedgeEndAngle   = fixedAngles[(i + 1) % fixedAngles.length].angle;

    // The fixed angle can be stored in our output.
    itemAngles[wedgeBeginIndex] = wedgeBeginAngle;

    // Make sure we loop around.
    if (wedgeEndAngle <= wedgeBeginAngle) {
      wedgeEndAngle += 360;
    }

    // Calculate the number of items between the begin and end indices.
    let wedgeItemCount =
        (wedgeEndIndex - wedgeBeginIndex - 1 + items.length) % items.length;

    // We have one item more if the parent link is inside our wedge.
    let parentInWedge = false;

    if (parentAngle != undefined) {
      // It can be that the parent link is inside the current wedge, but it's angle is
      // one full turn off.
      if (parentAngle < wedgeBeginAngle) {
        parentAngle += 360;
      }

      parentInWedge = parentAngle > wedgeBeginAngle && parentAngle < wedgeEndAngle;
      if (parentInWedge) {
        wedgeItemCount += 1;
      }
    }

    // Calculate the angular difference between consecutive items in the current wedge.
    const wedgeItemGap = (wedgeEndAngle - wedgeBeginAngle) / (wedgeItemCount + 1);

    // Now we assign an angle to each item between the begin and end indices.
    let index             = (wedgeBeginIndex + 1) % items.length;
    let count             = 1;
    let parentGapRequired = parentInWedge;

    while (index != wedgeEndIndex) {
      let itemAngle = wedgeBeginAngle + wedgeItemGap * count;

      // Insert gap for parent link if required.
      if (parentGapRequired && itemAngle + wedgeItemGap / 2 - parentAngle > 0) {
        count += 1;
        itemAngle         = wedgeBeginAngle + wedgeItemGap * count;
        parentGapRequired = false;
      }

      itemAngles[index] = itemAngle % 360;

      index = (index + 1) % items.length;
      count += 1;
    }
  }

  return itemAngles;
}
