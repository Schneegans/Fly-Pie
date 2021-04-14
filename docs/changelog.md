<p align="center">
  <img src ="pics/banner-04.jpg" />
</p>

# Changelog of Fly-Pie

## [Fly-Pie 5](https://github.com/schneegans/fly-pie/releases/tag/v5)

**Release Date:** 2021-04-12

#### New Features
* A new interaction mode has been added which is specifically useful on **touch-pads**: **Turbo Mode**! You can now also "draw" gestures as long as a modifier key, such as <kbd>Ctrl</kbd>, <kbd>Shift</kbd>, or <kbd>Alt</kbd> is held down **without having to press your mouse button**! This is especially useful when you opened the menu with a shortcut involving such a modifier key. You can just keep it pressed and move the pointer with the mouse or your touch-pad!
* There is also a new advanced setting which lets you **select items without the need to press any key or button**. This can improve selection speeds significantly if you know your menus by heart. It is also useful if you open your menus with other means, such as Easystroke or hot corners.
* New theming options: 
  - Select **background images** for your items!
  - **Crop item icons** to fit them in a circle!
* A set of **new presets** has been added which resemble the style of some well-known GTK themes:
  - Adwaita, Adwaita Dark, Arc, Arc Dark, Orchis & Yaru
* `OnHover` and `OnUnhover` **signals** have been added to the D-Bus interface.
* Actions and Menus can now define their own configuration widgets. Therefore **items can now have an arbitrary number of settings**. This leads to some changes of the D-Bus interface but it should be backwards compatible.
* The "**Running Applications**" menu uses this new feature by adding several options:
  - Peek hovered window.
  - Group windows by application.
  - Show only windows of the current workspace.
  - Filter windows by name.

#### Other Enhancements
* The documentation has been improved significantly. There are now many topics covered, especially guides on how to contribute to the project.
* It is now easier to create new translations (thank you, [daPhipz](https://github.com/daPhipz)!).
* Added several continuous integration checks (thank you once more, [daPhipz](https://github.com/daPhipz)!).
* The layout of the settings dialog has been improved in several places.
* It's now possible to **become a sponsor of Fly-Pie**! For as little as 1$ you can make sure that I stay motivated to work on this project!
* Sponsors and contributors have been added to the about-popover.

#### Bug Fixes
* Custom user presets get overridden when the extension is updated. This is still the case but now a warning is shown when the user attempts to store a preset in the extension's directory.
* Shortcut selections can now be canceled by mouse clicks.
* Text icons now use the configured font and color.
* The select-application-popover is now hidden once an app is selected.
* The select-icon-popover is now hidden once an app is selected.

## [Fly-Pie 4](https://github.com/schneegans/fly-pie/releases/tag/v4)

**Release Date:** 2020-12-04

#### New Features
* Fly-Pie has now **localization support**. That means, you can now [translate it to your own language](translating.md)! Pull requests are very welcome (there is also a new **pull request template for translations**!), also for updating the existing translations. Fly-Pie 4 comes with translations for the following languages:
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
* `metadata.json` now lists GNOME Shell version `3.36` as opposed to `3.36.2`. I believe it's sufficient to list major and minor version numbers only.
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
  <a href="creating-menus.md"><img src ="pics/left-arrow.png"/> Creating New Menu Types</a>
  <img src="pics/nav-space.svg"/>
  <a href="../README.md#getting-started"><img src ="pics/home.png"/> Index</a>
  <img src="pics/nav-space.svg"/>
  <a href="release-management.md">Release Management <img src ="pics/right-arrow.png"/></a>
</p>
