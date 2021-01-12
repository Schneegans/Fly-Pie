<p align="center">
  <img src ="pics/banner-01.jpg" />
</p>

# First Steps with Fly-Pie

If you installed and enabled Fly-Pie for the very first time, you can bring up the default menu with <kbd>Ctrl</kbd> + <kbd>Space</kbd>.
Here are some hints to ease your path to become a master pielot:

* When you open the settings dialog of Fly-Pie, you will be greeted with an **interactive tutorial** demonstrating effective usage patterns.
* You can **click anywhere in an item's wedge**. It does not matter whether you click directly on an item or at the edge of your screen as long as you are in the same wedge.
* To enter **Marking Mode**, click and drag an item. As soon as you pause dragging or make a turn, the item will be selected. **This way you can select items with gestures!**
* Try remembering the path to an item. Open the menu and **draw the path with your mouse**. You can start with individual segments of the path, put you can also try to draw the entire path!
* You may find it more successful if you explicitly try to compose your gesture of straight parts. **Do not draw curvy paths but rather expressive zig-zag-lines!**

_:information_source: **Tip:** If no menu shows up, you can execute the following command in a terminal, try again to open the menu and look for any errors.
This may print many unrelated messages, but using `grep` like this highlights all occurrences of `flypie`
which makes spotting Fly-Pie-related messages much easier._

```bash
journalctl -f -o cat | grep -E 'flypie|'
```

## Bake Your First Pie Menu!

<img align="right" width="250px" src ="pics/menu-editor.png" />

The default menu may give you the opportunity to play around with Fly-Pie,
but you should definitely define your own menus!
To open the settings dialog, you can use the `gnome-tweak-tool`, the `gnome-extensions-app` or this command:

```
gnome-extensions prefs flypie@schneegans.github.com`
```

The configuration dialog of Fly-Pie has four pages.
On the first you will find the **tutorial**,
on the second you can define its **appearance**,
and on the third you can **define your own menus**.
The last one... well, we will come to this later!

With the play-button you can always open a **live-preview** of your menu.
Just play around with the options, most of it should be more or less self-explanatory.

## Alternative Ways to Open Menus

There are two possibilities to open menus.
Either via the configured shortcut or with a terminal command as [described on the next page](dbus-interface.md).
This second approach can be used in combination with other tools.
Interesting companions are:

* [CustomCorner](https://extensions.gnome.org/extension/1037/customcorner/): Open menus by moving your mouse to one corner of your screen!
* [Easystroke](https://github.com/thjaeger/easystroke/wiki): X11 only, use mouse gestures to open menus!
* [xbindkeys](http://www.nongnu.org/xbindkeys/xbindkeys.html): X11 only, bind menus to your additional mouse buttons!

<p align="center"><img src ="pics/hr.svg" /></p>

<p align="center">
  <img src="pics/nav-space.svg"/>
  <a href="installation.md"><img src ="pics/left-arrow.png"/> Installation</a>
  <img src="pics/nav-space.svg"/>
  <a href="../README.md#getting-started"><img src ="pics/home.png"/> Index</a>
  <img src="pics/nav-space.svg"/>
  <a href="dbus-interface.md">The D-Bus interface <img src ="pics/right-arrow.png"/></a>
</p>
