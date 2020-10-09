# Changelog of Fly-Pie

## [Fly-Pie 3](https://github.com/schneegans/fly-pie/releases/tag/v3)

**Release Date:** -

#### New Features

* It is now possible to drag'n'drop things to the menu editor in order to create corresponding menu items. You can try dragging *.desktop files, other files, URLs or arbitrary text to the menu editor.
* You can now copy menu items by dragging them somewhere else in the menu editor while holding down the <kbd>Ctrl</kbd> key.
* Fly-Pie now works on systems with multiple monitors attached (thank you @gaamdalurt).
* A simple About-Popover has been added. It primarily shows the version of Fly-Pie so that a user can tell which version is installed.

#### Other Enhancements

* Several aspects of Fly-Pie have been updated so that it should run on various Linux distributions and versions without major issues. These have been tested so far:
  * Ubuntu 20.04 and 20.10.
  * Fedora 32 and 33.
  * Pop!_OS 20.04.
* The default menu has been slightly changed. The "Fly-Pie Settings" item is now a root menu item and the "Default Applications" submenu has been replaced with the "Favorites" submenu.
* `GMenu` is now an optional dependency. On systems where this is not available, the Main-Menu Submenu will not be available.
* Some icons of the default menu and the settings dialog have been changed to be compatible with more icon themes.
* Fly-Pie now prints log messages also from the settings dialog. You can view them with `journalctl -f -o cat` - this makes debugging much easier!

#### Bug Fixes

* A bug has been fixed which made the Main-Menu Submenu unusable.
* A bug has been fixed which caused an erroneous rendering of the settings dialog.
* Fly-Pie does not use `notify-send` anymore. This fixes several crashes on systems where this is not available.
* Several non-fatal programming errors of the settings dialog have been fixed.

## [Fly-Pie 2](https://github.com/schneegans/fly-pie/releases/tag/v2)

**Release Date:** 2020-08-29

#### New Features

* An interactive tutorial has been added. This tutorial can be accessed via the settings dialog of Fly-Pie.
* The settings dialog now remembers the last open settings page. When re-opened, it will show the page which was visible when the settings dialog was closed last time.
* `metadata.json` now lists Gnome Shell version `3.36` as opposed to `3.36.2`. I believe it's sufficient to list major and minor version numbers only.
* The `README.md` of Fly-Pie now uses [dynamic badges](https://schneegans.github.io/tutorials/2020/08/16/badges) to show the lines of code and percentage of comments.
* This changelog has been added.

#### Bug Fixes

* The D-Bus signals `OnCancel` and `OnSelect` now return the correct menu ID.
* `flush()`is now called on the D-Bus object before unexporting as suggested by andyholmes on https://extensions.gnome.org/review/18370.

## [Fly-Pie 1](https://github.com/schneegans/fly-pie/releases/tag/v1)

**Release Date:** 2020-08-13

* Initial publication under the MIT license on Github.
