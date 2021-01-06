# Changelog of Fly-Pie

## [Fly-Pie 4](https://github.com/schneegans/fly-pie/releases/tag/v4)

**Release Date:** 2020-12-04

#### New Features
* Fly-Pie has now **localization support**. That means, you can now [translate it to your own language](https://github.com/Schneegans/Fly-Pie#translating-fly-pie)! Pull requests are very welcome (there is also a new **pull request template for translations**!), also for updating the existing translations. Fly-Pie 4 comes with translations for the following languages:
  * English
  * German
  * Italian
* It is now possible to **export or import the menu configuration**.
* A new predefined **System Menu** is now available which shows items for screen-lock, shutdown, settings, etc.
* There is **no differentiation between top-level and submenus anymore**; the items `Top-Level Menu` and `Submenu` are now merged to a `Custom Menu`. This has multiple implications:
  * You can **drag entire menus into other menus** in the menu editor. Or you can make a former submenu to a top-level menu by drag'n'drop.
  * All **predefined menus (`Bookmarks`, `Devices`, etc.) can now be top-level menus** on their own.
  * It's now possible to **reorder menus** in the menu editor.
* The **D-Bus interface of Fly-Pie now supports all action of menu types**. You can open any menu you can configure in the menu editor also via the D-Bus interface. The README.md has been extended to contain a full description of the menu configuration format.
* A **warning is now shown in the settings dialog if GNOME Shell's animations are disabled** (in this case Fly-Pie does not really work). There is a button which can be used to enable the animations.

#### Other Enhancements
* Several new **continuous integration checks** have been added.
  * [ShellCheck](https://www.shellcheck.net/) is run against all scripts.
  * Some error conditions in the scripts are tested.
  * It's tested whether the translations compile successfully.
  * It's tested whether the release zip can be created successfully.
* A lot of the code has been refactored, especially the `ItemRegistry` has been split up so that all action and menu types have their own files now.

#### Acknowledgements
* Many thanks to [daPhipz](https://github.com/daPhipz) for your great contributions!
* Many thanks to [albanobattistella](https://github.com/albanobattistella) for the Italian translation!


## [Fly-Pie 3](https://github.com/schneegans/fly-pie/releases/tag/v3)

**Release Date:** 2020-10-10

#### New Features

* It is now possible to **drag'n'drop things to the menu editor** in order to create corresponding menu items. You can try dragging *.desktop files, other files, URLs or arbitrary text to the menu editor.
* You can now **copy menu items** by dragging them somewhere else in the menu editor while holding down the <kbd>Ctrl</kbd> key.
* Fly-Pie now works on systems with **multiple monitors** attached (thank you @gaamdalurt).
* A simple **About-Popover** has been added. It primarily shows the version of Fly-Pie so that a user can tell which version is installed.

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

<p align="center"><img src ="pics/hr.svg" /></p>
<p align="center">
  <a href="features.md">&#11013; Features</a>
  <img src="pics/nav-space.svg"/>
  <a href="../README.md">&#127968; Index</a>
  <img src="pics/nav-space.svg"/>
  <a href="installation.md">Installation &#10145;</a>
</p>
