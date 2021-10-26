<p align="center">
  <img src ="pics/banner-04.jpg" />
</p>

# Changelog of Fly-Pie

## [Fly-Pie 8](https://github.com/schneegans/fly-pie/releases/tag/v8)

**Release Date:** 2021-10-26

#### New Features

* A new default theme has been added. The dark color scheme is supposed to blend better with the default GNOME Shell theme.
* Icons can now be decorated with a colorful background circle! Just append a `-#rgb` or `-#rrggbb` to the icon name. A circle with the given RGB color will be drawn behind the icon. This is especially useful for symbolic icons. For example, the icon `go-left-symbolic` will look much more interesting like this: `go-left-symbolic-#49c`. This works for all icon types (e.g. system icons, built-in icons, emoji or text icons).
* The D-Bus API of Fly-Pie now includes a `SelectItem()` method which can be used to select an item of a currently opened menu programmatically. For example, this can be useful if you want to directly open a submenu. This is now also used by the live preview of the menu editor: If you click the preview button while you're inside a submenu, this submenu will be directly opened in the preview!

#### Other Enhancements

* Fly-Pie now supports GNOME 3.36, 3.38, 40, and 41 from one code base.
* Continuous integration is now used to run automated tests on the above GNOME versions on both, X11 and Wayland.
* A set of built-in icons has been added. The default example menu now uses these icons. Therefore, it should look the same on all systems now.
* The tutorial menu does not use Emojis any more because some systems have no emoji font installed per default. It now uses built-in icons as well and should be much easier to translate!
* Fly-Pie now uses a `Makefile` for building the extension instead of a bunch of custom scripts. Thank you, [@daPhipz](https://github.com/daPhipz)!
* New Translations!
  * ...

#### Bug Fixes

* <kbd>Tab</kbd> can now be used properly for opening menus.
* Symbolic icons are now colored correctly in menus.

## [Fly-Pie 7](https://github.com/schneegans/fly-pie/releases/tag/v7)

**Release Date:** 2021-09-25

#### New Features

* **Port to GNOME 40+**: Fly-Pie 7 has been tested on Fedora 34 and Fedora 35 which use GNOME Shell 40 and GNOME Shell 41.beta respectively.
  * Due to the massive changes to the codebase, this version is **not compatible with GNOME 3.3x**.
  * GNOME 40 makes some previously required workarounds to remove visual artifacts obsolete. This **improves menu performance** significantly!
* **WYSIWYG Menu Editor**: Due to [this bug](https://gitlab.gnome.org/GNOME/gtk/-/issues/3649), the old TreeView-based menu editor did not work under Gtk4. Therefore I choose to create a new menu editor from scratch!
  * The **menu items in the new editor are arranged in a circle**, exactly in the same directions as they will show up in the real menu.
  * The new menu editor fully supports **drag and drop**: You can reorder items, copy items (at least on Wayland, see [this bug](https://gitlab.gnome.org/GNOME/gtk/-/issues/4259)), and drop things from outside into the menu editor.
  * To simplify moving menu items around, there is a **Stash Area** at the bottom of the menu editor. You can drop menu items there and re-use them later.
  * The preferences dialog **opens much faster** on Gtk4 than it did on Gtk3. Thank you, GNOME devs!

#### Other Enhancements

* A warning will now be shown when the user imports a corrupt menu configuration.
* The **default menu** has been tweaked to be useful with horizontal workspaces. 
* The Custom Menu now uses a pencil as icon to emphasize that it's editable.
* The **documentation for translators** has been improved significantly. For instance, there are now screenshots available at [Weblate](https://hosted.weblate.org/projects/fly-pie/core/) for most strings.

#### Bug Fixes

* Fix Orchis theme. There were some issues with the center item cropping.
* Symbolic icons are now colored correctly in the menu editor.

## [Fly-Pie 6](https://github.com/schneegans/fly-pie/releases/tag/v6)

**Release Date:** 2021-05-09

#### New Features

* Finally, **achievements** have been implemented! This is something I had in mind since the beginning but no time to work on until now.
  * For now, 102 Achievements + 2 hidden achievements are available.
  * Each will give you some experience points which in turn will make you level up at certain points.
  * Once you reached level 10 you can truly call yourself **Master Pielot**!
  * Maybe some balancing will be required in the future, a feature like this is hard to test :smile:
  * Feel free to contribute ideas for new achievements!
* New preset: **Numix**! This uses the color palette of the well-known Numix theme.

#### Other Enhancements

* Fly-Pie can now be translated via [Weblate](https://hosted.weblate.org/engage/fly-pie/). Every contribution is very appreciated!
* New Continuous Integration (CI) checks have been added which actually test whether Fly-Pie can be installed on various GNOME Shell versions.
* The layout of the settings page of the preferences dialog has been improved.
* The layout of the tutorial page of the preferences dialog has been improved.
* Fly-Pie now uses GResources for asset loading. This should increase performance of the preferences dialog.

#### Bug Fixes
* Saved user presets are no longer added to the list of built-in presets.



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
