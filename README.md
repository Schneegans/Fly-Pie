<p align="center">
  <img src ="docs/pics/logo.gif" />
</p>

[![check](https://github.com/Schneegans/Fly-Pie/workflows/Checks/badge.svg?branch=develop)](https://github.com/Schneegans/Fly-Pie/actions)
[![Translation status](https://hosted.weblate.org/widgets/fly-pie/-/svg-badge.svg)](https://hosted.weblate.org/engage/fly-pie/)
[![license](https://img.shields.io/badge/license-MIT-purple.svg)](LICENSE)
[![loc](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/Schneegans/8f6459c2417de7534f64d98360dde865/raw/loc.json)](scripts/cloc.sh)
[![comments](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/Schneegans/8f6459c2417de7534f64d98360dde865/raw/comments.json)](scripts/cloc.sh)
[![download](https://img.shields.io/badge/download-extensions.gnome.org-e67f4d.svg)](https://extensions.gnome.org/extension/3433/fly-pie)

**Fly-Pie** is an attractive marking menu for GNOME Shell which can be used to launch applications, simulate hotkeys, open URLs and much more.
It features a continuous learning curve which lets you gradually lift-off from a grumpie menu rookie to a snappie menu pielot.
(You got it? Like pilot, but with a :cake:).

<a href="https://youtu.be/U22VxoT-tNU"><img align="right" width="350px" src ="docs/pics/player.jpg" /></a>

Fly-Pie lets you open _marking-menus_ of arbitrary depth via keyboard shortcuts.
When using Fly-Pie, there are three selection modes which can be used together. You do not have to decide which one to use; you can seamlessly transition between them:

* **Point-and-Click:** Select items by clicking on them or anywhere in the corresponding wedges.
* **Marking-Mode:** Select items by drawing gestures. To do this, click anywhere and drag your mouse while the left button is pressed over an item. As soon as you pause the movement or make a turn, the item will be selected.
* **Turbo-Mode:** You can also "draw" gestures as long as a modifier key, such as <kbd>Ctrl</kbd>, <kbd>Shift</kbd>, or <kbd>Alt</kbd> is held down **without having to press your mouse button**! This is especially useful when you opened the menu with a shortcut involving such a modifier key. You can just keep it pressed and move the pointer with the mouse or your touch-pad!

The menus and their appearance can be configured with a **Live Preview** which updates instantaneously.
You can compose your menus from various Action Types such as **Run Command**, **Activate Shortcut**, **Insert Text**, or **Open File**.
There are also several predefined Menu Types, such as **Bookmarks**, **Running Apps**, **Frequently Used Applications**, or **Pinned Applications**.

Last but not least, Fly-Pie features a **D-Bus Interface** which can be used to open your configured menus. It can also be used to open arbitrary menus defined with a JSON description. The item which was selected will be reported via a D-Bus signal.


# :heart: Will you love Fly-Pie?

<p align="center">
  <img src ="docs/pics/banner-05.jpg" />
</p>

Fly-Pie is designed for you **if you have one hand at the mouse** most of the time.
It is _not_ designed to be used with a keyboard only; there are other
applications which work better in this case (for example [kupfer](https://github.com/kupferlauncher/kupfer)).
Fly-Pie also works nicely with **touch input**.

If you want to learn more, use the links below for much more information!

## Getting Started

* [Installation](docs/installation.md)
* [First Steps](docs/first-steps.md)
* [The D-Bus Interface](docs/dbus-interface.md)

## Contributing to Fly-Pie

* [Contributing Guidelines](docs/contributing.md)
* [Software Architecture](docs/software-architecture.md)
* [Translating Fly-Pie](docs/translating.md)
* [Creating New Action Types](docs/creating-actions.md)
* [Creating New Menu Types](docs/creating-menus.md)

## Additional Information

* [Changelog](docs/changelog.md)
* [Release Management](docs/release-management.md)
* [Continuous Integration](docs/continuous-integration.md)

# :revolving_hearts: These people _do_ love Fly-Pie

Do you want to show that you love Fly-Pie too? You may <a href="https://github.com/sponsors/Schneegans">become a sponsor for as little as 1$ / month</a>!
While coding new features or translating Fly-Pie is the most awesome way to contribute, providing financial support will help me stay motivated to invest my spare time to keep the project alive in the future.

## :1st_place_medal: Gold Sponsors
<p align="center">
  <a href="https://github.com/sponsors/Schneegans">Be the first!</a>
</p>

## :2nd_place_medal: Silver Sponsors
<p align="center">
  GEPLlinux<br>
  <a href="https://www.llorachdevs.com/Home">Garsiv</a><br>
  <a href="https://github.com/SimHacker">@SimHacker</a><br>
</p>

## :3rd_place_medal: Bronze Sponsors
<p align="center">
  <a href="https://github.com/denis-roy">@denis-roy</a><br>
  <a href="https://github.com/ykhurshid">@ykhurshid</a>
</p>

<p align="center"><img src ="docs/pics/hr.svg" /></p>