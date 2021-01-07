<p align="center">
  <img src ="docs/pics/logo.gif" />
</p>

[![check](https://github.com/Schneegans/Fly-Pie/workflows/Checks/badge.svg?branch=develop)](https://github.com/Schneegans/Fly-Pie/actions)
[![shell](https://img.shields.io/badge/Gnome_Shell-3.38-blue.svg)](metadata.json)
[![license](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)
[![loc](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/Schneegans/8f6459c2417de7534f64d98360dde865/raw/loc.json)](cloc.sh)
[![comments](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/Schneegans/8f6459c2417de7534f64d98360dde865/raw/comments.json)](cloc.sh)
[![download](https://img.shields.io/badge/Download-extensions.gnome.org-e67f4d.svg)](https://extensions.gnome.org/extension/3433/fly-pie)

**Fly-Pie** is an attractive marking menu for Gnome Shell which can be used to launch applications, simulate hotkeys, open URLs and much more.
It features a continuous learning curve which lets you gradually lift-off from a grumpie menu rookie to a snappie menu pielot.
(You got it? Like pilot, but with a :cake:).

## About Fly-Pie

<a href="https://youtu.be/U22VxoT-tNU"><img align="right" width="300px" src ="docs/pics/player.png" /></a>

Fly-Pie is designed for people who have **one hand at the mouse** most of the time.
It is **not** designed to be used with a keyboard only; there are other
applications which work better in this case (for example [kupfer](https://github.com/kupferlauncher/kupfer)).
Fly-Pie will also play nicely with **touch input**.
While it might work already, a future version of Fly-Pie will be dedicated to
add proper touch support.

Click the player image on the right to watch a trailer on YouTube!

## Features

_:construction: **Under Construction:** Fly-Pie is still under heavy development!
Whenever you encounter a :beetle: bug or have :tada: feature request,
report this via [Github issues](https://github.com/schneegans/fly-pie/issues)._

The list below provides both, a high-level overview of Fly-Pie's current
capabilities as well as a rough idea of planned features.
Check out the [changelog](docs/changelog.md) as well!

- [X] Create as many menus as you want.
- [X] Bind menus to shortcuts.
- [X] Create as deep menu hierarchies as you want.
- [X] Two selection modes which can be used together:
  - [X] **Point-and-Click:** Select items by clicking anywhere in the corresponding wedge.
  - [X] **Marking-Mode:** Select items by drawing gestures.
- [X] **Live Preview:** See your configuration changes instantaneously.
- [X] Available Menu Types:
  - [X] **Custom Menu:** Fill this with actions or submenus!
  - [X] **Bookmarks:** Shows your commonly used directories.
  - [X] **Devices:** Shows connected devices.
  - [X] **Running Apps:** Shows the currently running applications.
  - [X] **Recent Files:** Shows your recently used files.
  - [X] **Frequently Used:** Shows your frequently used applications.
  - [X] **Favorites:** Shows your pinned applications.
  - [X] **Main Menu:** Shows all installed applications (This requires GMenu typelib to be installed. `sudo apt-get install gir1.2-gmenu-3.0` on Ubuntu).
- [X] Available Actions Types:
  - [X] **Run Command:** Executes any given shell command.
  - [X] **Activate Shortcut:** Simulates a key stroke.
  - [X] **Insert Text:** Pastes some given text to wherever the cursor currently is.
  - [X] **Open URI:** Opens an URI with the default applications.
  - [X] **Open File:** Opens a file with the default applications.
  - [X] **D-Bus Signal:** Emits a signal on the D-Bus.
- [X] D-Bus Interface:
  - [X] Open pre-configured menus via the D-Bus.
  - [X] Open custom menus via the D-Bus.
- [X] Available on [extensions.gnome.org](https://extensions.gnome.org/extension/3433/fly-pie).
- [X] Translation Support:
  - [X] English
  - [X] German
  - [X] Italian
  - [ ] ...
- [ ] Proper touch support.
- [ ] Cool appearance presets.
- [ ] Achievements!

## General information

* [Changelog](docs/changelog.md)

## Using Fly-Pie

* [Installation](docs/installation.md)
* [First Steps](docs/first-steps.md)
* [The D-Bus interface](docs/dbus-interface.md)

## Contributing to Fly-Pie

* [Contributing Guidelines](docs/contributing.md)
* [Translating Fly-Pie](docs/translating.md)
