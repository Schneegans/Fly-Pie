<!--
SPDX-FileCopyrightText: Simon Schneegans <code@simonschneegans.de>
SPDX-License-Identifier: CC-BY-4.0
-->

<p align="center">
  <img src ="pics/banner-04.jpg" />
</p>

# Changelog of Fly-Pie

## [unreleased]

**Release Date:** TBD

#### Bug Fixes

- Fixed selecting items on GNOME 46 requiring two clicks.
- Fixed a bug which caused achievement notifications to be not shown on GNOME 46.

## [Fly-Pie 25](https://github.com/schneegans/fly-pie/releases/tag/v25)

**Release Date:** 2024-02-27

#### Enhancements

- The extension has been updated to work with GNOME 46. Some refactoring was required, so please report any issues you encounter!
- Instead of an always out-of-date list of sponsors, the main menu of the preferences dialog now contains a link to the new [list of all donors](https://schneegans.github.io/sponsors/). This list is semi-automatically updated whenever a new donation is received. Thanks to all the donors!
- Several translation updates. Thanks to all the translators!
- All CI jobs are now executed for GNOME 45 and GNOME 46 as well.

#### Changes

- Due to the removal of `Clutter.Canvas` in GNOME 46, the icons of the menu are now drawn with a `St.DrawingArea`. This brings some subtle changes for the menu item transitions when hovering or selecting items.

#### Bug Fixes

- Fixed a regression which caused an error when trying to load theme presets in the settings dialog.

## [Fly-Pie 24](https://github.com/schneegans/fly-pie/releases/tag/v24)

**Release Date:** 2023-09-14

#### Changes

- According to new extension review policies, it is not allowed to use GTK in GNOME 45 extensions anymore. This limits some functionalities of Fly-Pie. These features were affected:
  - The "Recent Files" submenu cannot work anymore and has been removed.
  - The simulation of hotkeys cannot use `Gtk.accelerator_parse()` anymore. The code has been refactored to use a custom parsing code instead. Please report any issues you encounter while simulating hotkeys!

#### Bug Fixes

- Fixed a bug which caused the menu to be stuck occasionally on Wayland.

## [Fly-Pie 23](https://github.com/schneegans/fly-pie/releases/tag/v23)

**Release Date:** 2023-09-09

#### Major Changes

- This is the first release of Fly-Pie supporting GNOME 45. This required a [major refactoring](https://github.com/Schneegans/Fly-Pie/pull/318/files) of the code base as GJS now uses ESM modules. As a consequence, this version is not compatible with older versions of GNOME Shell anymore. The old code base is still available on the `gnome-3.36-44` branch and if new features are added (especially translations), they can be backported to this branch.

## [Fly-Pie 22](https://github.com/schneegans/fly-pie/releases/tag/v22)

**Release Date:** 2023-09-04

#### Enhancements

- The default <kbd>Ctrl</kbd>+<kbd>Space</kbd> shortcut is now mentioned in the tutorial as well as in multiple other parts of the documentation.

#### Bug Fixes

- Fixed a bug which caused the achievement notification not to be shown on GNOME 44.
- Fixed a compatibility issue with newer versions of GNOME Shell which caused the Insert-Text Action to not work anymore.

## [Fly-Pie 21](https://github.com/schneegans/fly-pie/releases/tag/v21)

**Release Date:** 2023-06-09

#### Enhancements

- Added support for the new donation button on extensions.gnome.org.
- Several translation updates, including a completely new Swedish translation! Thanks to all the translators!

## [Fly-Pie 20](https://github.com/schneegans/fly-pie/releases/tag/v20)

**Release Date:** 2023-04-26

#### Enhancements

- It is now possible to shrink the preferences window below its initial size.
- Several translation updates, including a completely new Japanese translation! Thanks to all the translators!

#### Bug Fixes

- Fixed simulating hotkeys on GNOME 44.
- Fixed an issue which caused achievement notifications to be not translated.

## [Fly-Pie 19](https://github.com/schneegans/fly-pie/releases/tag/v19)

**Release Date:** 2023-04-02

#### New Features

- It is now possible to show **tiny item labels** on all items of a given submenu. Just enable the new switch "Show Labels" of a menu or submenu!
- You can now **click on the center item to navigate to the parent menu**. Clicking in the center of the root menu will dismiss the menu. This is especially useful on touch screens where there is no right click.

#### Enhancements

- **New donation method: Ko-fi**. Follow me on Ko-fi to get the latest updates regarding my extensions: https://ko-fi.com/schneegans!
- **New Preset: Catppuccin**. Soothing warm pastel pinks for Fly-Pie!
- The Bookmarks submenu now attempts to use directory-specific icons (for directories such as Downloads, Documents, Music, etc.).
- Fly-Pie menus are now opened across all monitors. Before they were limited to the monitor currently having mouse input focus.
- The custom info-popover has been replaced by a more traditional main menu. It gives access to Fly-Pie's homepage, the bug tracker and some donation options.
- An about dialog has been added. If available, the `Adw.AboutWindow` is used.
- Several translations received updates. Thanks to all the translators!

#### Bug Fixes

- Fixed multi-cursor support. Fly-Pie should now properly support multiple pointer input devices on Wayland.
- Fixed an issue which made the menu invisible above full-screen windows on Wayland.
- Fixed an issue which could make Fly-Pie unresponsive until the session is restarted if the configured hotkey was pressed multiple times during a configured display timeout. In rare cases this could also lead to completely blocking the user input.
- Fixed icon loading on GNOME 44. Due to some recent changes in GNOME 44, icons were not loaded correctly anymore.
- Fixed some implicit casts in the shader code of the selection wedges which could lead to shader compilation errors on certain GLSL versions.

## [Fly-Pie 18](https://github.com/schneegans/fly-pie/releases/tag/v18)

**Release Date:** 2023-02-28

#### New Features

- Added support for GNOME 44.
- There is a new option in the advanced settings which allows disabling the move-new-windows-to-pointer feature.

#### Other Enhancements

- Many translations received updates. Thanks to all the translators!
- Fly-Pie now follows the [REUSE Specification](https://reuse.software/spec).

## [Fly-Pie 17](https://github.com/schneegans/fly-pie/releases/tag/v17)

**Release Date:** 2022-09-14

#### New Features

- Added support for GNOME 43.

#### Enhancements

- Many translations received updates. Thanks to all the translators!
- All included SVG files have been optimized to reduce the size of the installed extension.
- The Running-Apps Menu, will now minimize windows which were un-minimized by hover-peeking when the corresponding item is not hovered anymore.

#### Bug Fixes

- Fixed a bug which could lead to an unexpected selection of an item if the previous selection in marking mode was aborted (thank you [@GestaltEngine](https://github.com/GestaltEngine) for this fix!).
- There seem to be cases were `libadwaita` is not available on GNOME 42 (e.g. Pop!\_OS 22.04 beta). The preferences dialog now tries to fallback to the GTK4-only variant if `libadwaita is not available`.
- Fixed garbled text in the tutorial by justifying text to the left.
- Fixed an issue which made the menu editor not properly show shortcuts involving '<' or '>'.

## [Fly-Pie 16](https://github.com/schneegans/fly-pie/releases/tag/v16)

**Release Date:** 2022-03-29

#### Enhancements

- Add a new `ToggleMenu` D-Bus method which can be used to, well, toggle a menu (thank you [@GestaltEngine](https://github.com/GestaltEngine) for this contribution!).

#### Bug Fixes

- Fixed the version check for GNOME Shell `42.rc` (before it only worked on `42.alpha` and `42.beta`)

## [Fly-Pie 15](https://github.com/schneegans/fly-pie/releases/tag/v15)

**Release Date:** 2022-03-27

#### Enhancements

- Many translation updates. A BIG THANKS to all translators!

#### Bug Fixes

- Fixed the version check for GNOME Shell 42.

## [Fly-Pie 14](https://github.com/schneegans/fly-pie/releases/tag/v14)

**Release Date:** 2022-03-07

#### New Features

- Added initial support for GNOME Shell 42.

#### Other Enhancements

- Fly-Pie is now compatible with fractional scaling on Wayland and X11.
- Fly-Pie now works on GNOME Shell 40+, even if animations are disabled (even though it does not look as slick as it could, but I guess that's the point of disabling animations 😛). Therefore, the corresponding warning in the settings dialog is not shown anymore.
- The branching scheme of Fly-Pie has been simplified, and the corresponding guides have been updated. There is no `develop` branch anymore, and the new default branch is `main`.

#### Bug Fixes

- The menu position is not smoothly transitioning anymore if opened on a different monitor.
- Fixed an issue which caused items to be pre-selected when the menu was not opened on the left-most monitor (#206).

## [Fly-Pie 13](https://github.com/schneegans/fly-pie/releases/tag/v13)

**Release Date:** 2022-01-12

#### New Features

- Added a new `CancelMenu` D-Bus method for closing a currently open menu.

#### Other Enhancements

- The advanced "Selection Timeout" can now be set to zero. If it is set to zero, submenus will be selected instantaneously once the gesture length exceeds the "Minimum Stroke Length".
- Better gesture recognition: When making a sharp turn with your pointer, the selected submenu will open closer to where you actually started the turn.
- A completely new translation to French (thank you, [@Clemovski](https://github.com/Clemovski)!).

#### Bug Fixes

- Fix marking mode on GNOME Shell 3.36 and 3.38.

## [Fly-Pie 12](https://github.com/schneegans/fly-pie/releases/tag/v12)

**Release Date:** 2021-12-07

#### Other Enhancements

- Updated Spanish translation (thank you, Óscar Fernández Díaz!).
- Renamed `master` branch to `main`.

#### Bug Fixes

- Fixed a bug which caused two sliders of the advanced settings to be rendered on top of each other under GTK3 (#175).
- Fixed a bug which caused the overview to be opened when an item was selected with a mouse click while the <kbd>Super</kbd> key was held down (#176).

## [Fly-Pie 11](https://github.com/schneegans/fly-pie/releases/tag/v11)

**Release Date:** 2021-12-01

#### Other Enhancements

- Fixed a remark made by reviewers on extensions.gnome.org.

## [Fly-Pie 10](https://github.com/schneegans/fly-pie/releases/tag/v10)

<a href="https://youtu.be/BGXtckqhEIk"><img align="right" src ="pics/player6.jpg" /></a>

**Release Date:** 2021-12-01

#### New Features

- **Touch Buttons** can now be enabled for each configured menu. A touch button is a floating button which can be moved anywhere on your screen and will open the corresponding menu when activated. In fact, you do not need to click the button, you can also start dragging on the button in a specific direction to directly enter the marking mode of the menu.
- **Open menus with <kbd>Super</kbd>+<kbd>RMB</kbd>**: You can now assign one of your menus to be opened when you press the right mouse button while holding down the <kbd>Super</kbd> key. This option then replaces the default window menu which would be opened with this combination.
- New **Clipboard Menu**: This menu shows recently copied things.
  On selection, the respective item is pasted.
  The menu currently supports text, raster and vector images, and files copied from the file manager.
  However, the clipboard is a very complex thing and there are some limitations.
  When the user presses <kbd>Ctrl</kbd>+<kbd>C</kbd>, the clipboard does not magically store the data, it rather registers the data provider together with a list of data formats (mime types) in which the provider could later deliver the data directly to a receiver (e.g. when the user presses <kbd>Ctrl</kbd>+<kbd>V</kbd> somewhere else).
  To store a history of copied things, Fly-Pie has to request the data from the current provider.
  However, it cannot know beforehand, in which format any receiving application would like to have the data.
  So it just makes some assumptions and stores the data in a quite commonly used format and hopes that the receiver will understand the format.
- A new advanced setting has been added to **delay the visual appearance** of Fly-Pie menus. This allows selecting items without showing the menu resulting in a less disruptive workflow for expert users.
- Fly-Pie will now attempt to **open windows at the current pointer location** in order to reduce mouse travel. Whenever an action is executed, Fly-Pie checks whether a window is opened within the next second. If this happens, the newly opened window is moved to the pointer.
- Icons can now be given as [**base64 encoded data URIs**](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URIs).
  This allows creating menus with completely application defined icons.
- **Two new D-Bus methods** have been added (`ShowMenuAt` and `ShowCustomMenuAt`) which can be used to open a menu at specific pixel coordinates.

#### Other Enhancements

- **Better touch support**! Touch screens are now well-supported on Wayland and X11.
- **Support for tablets**! Pen input is now well-supported on Wayland and X11. On Wayland, multi-cursor setups should be working as well.
- **Gesture detection has been improved**. Really fast pointer movements should now be detected more reliably.
- It is now possible to **copy items in the menu editor** under GTK3 by holding the <kbd>Ctrl</kbd> key while dragging.

#### Bug Fixes

- Fixed a bug which caused random menus get deleted while dragging something to the stash area under GTK3.

## [Fly-Pie 9](https://github.com/schneegans/fly-pie/releases/tag/v9)

**Release Date:** 2021-11-05

#### Bug Fixes

- Fixed a bug which crashed the settings dialog when the introspection data for Clutter was not installed.

## [Fly-Pie 8](https://github.com/schneegans/fly-pie/releases/tag/v8)

<a href="https://youtu.be/j9t7hfkE_5w"><img align="right" src ="pics/player5.jpg" /></a>

**Release Date:** 2021-10-26

#### New Features

- A **new default theme** has been added. The dark color scheme is supposed to blend better with the default GNOME Shell theme.
- **Icons can now be decorated with a colorful background circle!** Just append a `-#rgb` or `-#rrggbb` to the icon name. A circle with the given RGB color will be drawn behind the icon. This is especially useful for symbolic icons. For example, the icon `go-left-symbolic` will look much more interesting like this: `go-left-symbolic-#49c`. This works for all icon types (e.g. system icons, built-in icons, emoji or text icons).
- The D-Bus API of Fly-Pie now includes a `SelectItem()` method which can be used to **select an item of a currently opened menu programmatically**. For example, this can be useful if you want to directly open a submenu. This is now also used by the live preview of the menu editor: If you click the preview button while you're inside a submenu, this submenu will be directly opened in the preview!

#### Other Enhancements

- Fly-Pie now **supports GNOME 3.36, 3.38, 40, and 41** from one code base.
- **Continuous integration** is now used to run automated tests on the above GNOME versions on both, X11 and Wayland.
- A set of **built-in icons** has been added. The default example menu now uses these icons. Therefore, it should look the same on all systems now.
- The tutorial menu does not use Emojis any more because some systems have no emoji font installed per default. It now uses built-in icons as well and should be much easier to translate!
- Fly-Pie now uses a `Makefile` for building the extension instead of a bunch of custom scripts. Thank you, [@daPhipz](https://github.com/daPhipz)!
- Fly-Pie is now translated into the following languages (in most cases partially, feel free to [contribute](https://hosted.weblate.org/engage/fly-pie/)!):
  - German
  - English
  - Chinese (Simplified)
  - Dutch
  - Finnish
  - Italian
  - Korean
  - Norwegian Bokmål
  - Portuguese
  - Portuguese (Brazil)
  - Russian
  - Sinhala
  - Spanish

#### Bug Fixes

- <kbd>Tab</kbd> can now be used properly for opening menus.
- Symbolic icons are now colored correctly in menus.

## [Fly-Pie 7](https://github.com/schneegans/fly-pie/releases/tag/v7)

<a href="https://youtu.be/sRT3O9-H5Xs"><img align="right" src ="pics/player4.jpg" /></a>

**Release Date:** 2021-09-25

#### New Features

- **Port to GNOME 40+**: Fly-Pie 7 has been tested on Fedora 34 and Fedora 35 which use GNOME Shell 40 and GNOME Shell 41.beta respectively.
  - Due to the massive changes to the codebase, this version is **not compatible with GNOME 3.3x**.
  - GNOME 40 makes some previously required workarounds to remove visual artifacts obsolete. This **improves menu performance** significantly!
- **WYSIWYG Menu Editor**: Due to [this bug](https://gitlab.gnome.org/GNOME/gtk/-/issues/3649), the old TreeView-based menu editor did not work under Gtk4. Therefore I choose to create a new menu editor from scratch!
  - The **menu items in the new editor are arranged in a circle**, exactly in the same directions as they will show up in the real menu.
  - The new menu editor fully supports **drag and drop**: You can reorder items, copy items (at least on Wayland, see [this bug](https://gitlab.gnome.org/GNOME/gtk/-/issues/4259)), and drop things from outside into the menu editor.
  - To simplify moving menu items around, there is a **Stash Area** at the bottom of the menu editor. You can drop menu items there and re-use them later.
  - The preferences dialog **opens much faster** on Gtk4 than it did on Gtk3. Thank you, GNOME devs!

#### Other Enhancements

- A warning will now be shown when the user imports a corrupt menu configuration.
- The **default menu** has been tweaked to be useful with horizontal workspaces.
- The Custom Menu now uses a pencil as icon to emphasize that it's editable.
- The **documentation for translators** has been improved significantly. For instance, there are now screenshots available at [Weblate](https://hosted.weblate.org/projects/fly-pie/core/) for most strings.

#### Bug Fixes

- Fix Orchis theme. There were some issues with the center item cropping.
- Symbolic icons are now colored correctly in the menu editor.

## [Fly-Pie 6](https://github.com/schneegans/fly-pie/releases/tag/v6)

<a href="https://youtu.be/Lj-uefp36Jk"><img align="right" src ="pics/player3.jpg" /></a>

**Release Date:** 2021-05-09

#### New Features

- Finally, **achievements** have been implemented! This is something I had in mind since the beginning but no time to work on until now.
  - For now, 102 Achievements + 2 hidden achievements are available.
  - Each will give you some experience points which in turn will make you level up at certain points.
  - Once you reached level 10 you can truly call yourself **Master Pielot**!
  - Maybe some balancing will be required in the future, a feature like this is hard to test :smile:
  - Feel free to contribute ideas for new achievements!
- New preset: **Numix**! This uses the color palette of the well-known Numix theme.

#### Other Enhancements

- Fly-Pie can now be translated via [Weblate](https://hosted.weblate.org/engage/fly-pie/). Every contribution is very appreciated!
- New Continuous Integration (CI) checks have been added which actually test whether Fly-Pie can be installed on various GNOME Shell versions.
- The layout of the settings page of the preferences dialog has been improved.
- The layout of the tutorial page of the preferences dialog has been improved.
- Fly-Pie now uses GResources for asset loading. This should increase performance of the preferences dialog.

#### Bug Fixes

- Saved user presets are no longer added to the list of built-in presets.

## [Fly-Pie 5](https://github.com/schneegans/fly-pie/releases/tag/v5)

<a href="https://youtu.be/U22VxoT-tNU"><img align="right" src ="pics/player1.jpg" /></a>

**Release Date:** 2021-04-12

#### New Features

- A new interaction mode has been added which is specifically useful on **touch-pads**: **Turbo Mode**! You can now also "draw" gestures as long as a modifier key, such as <kbd>Ctrl</kbd>, <kbd>Shift</kbd>, or <kbd>Alt</kbd> is held down **without having to press your mouse button**! This is especially useful when you opened the menu with a shortcut involving such a modifier key. You can just keep it pressed and move the pointer with the mouse or your touch-pad!
- There is also a new advanced setting which lets you **select items without the need to press any key or button**. This can improve selection speeds significantly if you know your menus by heart. It is also useful if you open your menus with other means, such as Easystroke or hot corners.
- New theming options:
  - Select **background images** for your items!
  - **Crop item icons** to fit them in a circle!
- A set of **new presets** has been added which resemble the style of some well-known GTK themes:
  - Adwaita, Adwaita Dark, Arc, Arc Dark, Orchis & Yaru
- `OnHover` and `OnUnhover` **signals** have been added to the D-Bus interface.
- Actions and Menus can now define their own configuration widgets. Therefore **items can now have an arbitrary number of settings**. This leads to some changes of the D-Bus interface but it should be backwards compatible.
- The "**Running Applications**" menu uses this new feature by adding several options:
  - Peek hovered window.
  - Group windows by application.
  - Show only windows of the current workspace.
  - Filter windows by name.

#### Other Enhancements

- The documentation has been improved significantly. There are now many topics covered, especially guides on how to contribute to the project.
- It is now easier to create new translations (thank you, [daPhipz](https://github.com/daPhipz)!).
- Added several continuous integration checks (thank you once more, [daPhipz](https://github.com/daPhipz)!).
- The layout of the settings dialog has been improved in several places.
- It's now possible to **become a sponsor of Fly-Pie**! For as little as 1$ you can make sure that I stay motivated to work on this project!
- Sponsors and contributors have been added to the about-popover.

#### Bug Fixes

- Custom user presets get overridden when the extension is updated. This is still the case but now a warning is shown when the user attempts to store a preset in the extension's directory.
- Shortcut selections can now be canceled by mouse clicks.
- Text icons now use the configured font and color.
- The select-application-popover is now hidden once an app is selected.
- The select-icon-popover is now hidden once an app is selected.

## [Fly-Pie 4](https://github.com/schneegans/fly-pie/releases/tag/v4)

**Release Date:** 2020-12-04

#### New Features

- Fly-Pie has now **localization support**. That means, you can now [translate it to your own language](translating.md)! Pull requests are very welcome (there is also a new **pull request template for translations**!), also for updating the existing translations. Fly-Pie 4 comes with translations for the following languages:
  - English
  - German
  - Italian
- It is now possible to **export or import the menu configuration**.
- A new predefined **System Menu** is now available which shows items for screen-lock, shutdown, settings, etc.
- There is **no differentiation between top-level and submenus anymore**; the items `Top-Level Menu` and `Submenu` are now merged to a `Custom Menu`. This has multiple implications:
  - You can **drag entire menus into other menus** in the menu editor. Or you can make a former submenu to a top-level menu by drag'n'drop.
  - All **predefined menus (`Bookmarks`, `Devices`, etc.) can now be top-level menus** on their own.
  - It's now possible to **reorder menus** in the menu editor.
- The **D-Bus interface of Fly-Pie now supports all action of menu types**. You can open any menu you can configure in the menu editor also via the D-Bus interface. The README.md has been extended to contain a full description of the menu configuration format.
- A **warning is now shown in the settings dialog if GNOME Shell's animations are disabled** (in this case Fly-Pie does not really work). There is a button which can be used to enable the animations.

#### Other Enhancements

- Several new **continuous integration checks** have been added.
  - [ShellCheck](https://www.shellcheck.net/) is run against all scripts.
  - Some error conditions in the scripts are tested.
  - It's tested whether the translations compile successfully.
  - It's tested whether the release zip can be created successfully.
- A lot of the code has been refactored, especially the `ItemRegistry` has been split up so that all action and menu types have their own files now.

#### Acknowledgements

- Many thanks to [daPhipz](https://github.com/daPhipz) for your great contributions!
- Many thanks to [albanobattistella](https://github.com/albanobattistella) for the Italian translation!

## [Fly-Pie 3](https://github.com/schneegans/fly-pie/releases/tag/v3)

**Release Date:** 2020-10-10

#### New Features

- It is now possible to **drag'n'drop things to the menu editor** in order to create corresponding menu items. You can try dragging \*.desktop files, other files, URLs or arbitrary text to the menu editor.
- You can now **copy menu items** by dragging them somewhere else in the menu editor while holding down the <kbd>Ctrl</kbd> key.
- Fly-Pie now works on systems with **multiple monitors** attached (thank you @gaamdalurt).
- A simple **About-Popover** has been added. It primarily shows the version of Fly-Pie so that a user can tell which version is installed.

#### Other Enhancements

- Several aspects of Fly-Pie have been updated so that it should run on various Linux distributions and versions without major issues. These have been tested so far:
  - Ubuntu 20.04 and 20.10.
  - Fedora 32 and 33.
  - Pop!\_OS 20.04.
- The default menu has been slightly changed. The "Fly-Pie Settings" item is now a root menu item and the "Default Applications" submenu has been replaced with the "Favorites" submenu.
- `GMenu` is now an optional dependency. On systems where this is not available, the Main-Menu Submenu will not be available.
- Some icons of the default menu and the settings dialog have been changed to be compatible with more icon themes.
- Fly-Pie now prints log messages also from the settings dialog. You can view them with `journalctl -f -o cat` - this makes debugging much easier!

#### Bug Fixes

- A bug has been fixed which made the Main-Menu Submenu unusable.
- A bug has been fixed which caused an erroneous rendering of the settings dialog.
- Fly-Pie does not use `notify-send` anymore. This fixes several crashes on systems where this is not available.
- Several non-fatal programming errors of the settings dialog have been fixed.

## [Fly-Pie 2](https://github.com/schneegans/fly-pie/releases/tag/v2)

**Release Date:** 2020-08-29

#### New Features

- An interactive tutorial has been added. This tutorial can be accessed via the settings dialog of Fly-Pie.
- The settings dialog now remembers the last open settings page. When re-opened, it will show the page which was visible when the settings dialog was closed last time.
- `metadata.json` now lists GNOME Shell version `3.36` as opposed to `3.36.2`. I believe it's sufficient to list major and minor version numbers only.
- The `README.md` of Fly-Pie now uses [dynamic badges](https://schneegans.github.io/tutorials/2020/08/16/badges) to show the lines of code and percentage of comments.
- This changelog has been added.

#### Bug Fixes

- The D-Bus signals `OnCancel` and `OnSelect` now return the correct menu ID.
- `flush()`is now called on the D-Bus object before unexporting as suggested by andyholmes on https://extensions.gnome.org/review/18370.

## [Fly-Pie 1](https://github.com/schneegans/fly-pie/releases/tag/v1)

**Release Date:** 2020-08-13

- Initial publication under the MIT license on Github.

<p align="center"><img src ="pics/hr.svg" /></p>

<p align="center">
  <a href="creating-menus.md"><img src ="pics/left-arrow.png"/> Creating New Menu Types</a>
  <img src="pics/nav-space.svg"/>
  <a href="../README.md#getting-started"><img src ="pics/home.png"/> Index</a>
  <img src="pics/nav-space.svg"/>
  <a href="release-management.md">Release Management <img src ="pics/right-arrow.png"/></a>
</p>
