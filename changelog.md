# Changelog of Fly-Pie

## [v1.1.0](https://github.com/schneegans/fly-pie/releases/tag/v1.1.0)

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

## [v1.0.0](https://github.com/schneegans/fly-pie/releases/tag/v1.0.0)

**Release Date:** 2020-08-13

* Initial publication under the MIT license on Github.
