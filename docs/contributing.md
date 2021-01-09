<p align="center">
  <img src ="pics/banner-01.jpg" />
</p>

# Contributing to Fly-Pie

Thank you for contributing your idea to Fly-Pie! Here are some guidelines to help you comply with the workflow used in this project.

Whenever you encounter a :beetle: **bug** or have a :tada: **feature request**,
report this via [Github issues](https://github.com/schneegans/fly-pie/issues).

We are happy to receive contributions to Fly-Pie in the form of **pull requests** via Github.
Feel free to fork the repository, implement your changes and create a merge request to the `develop` branch.

## Debugging

Developing a Gnome Shell extension is not easy, as debugging possibilities are quite limited. One thing you should always do is to monitor Gnome Shells output for error or debug messages produced by Fly-Pie. This can be done with the command below. This may print many unrelated messages, but using `grep` like this highlights all occurrences of `flypie` which makes spotting Fly-Pie-related messages much easier.

```bash
journalctl -f -o cat | grep -E 'flypie|'
```

## Branching Guidelines

<a href="https://www.youtube.com/watch?v=1SXpE08hvGs"><img align="right" width="350px" src ="pics/player2.jpg" /></a>

The development of Fly-Pie follows a simplified version of **git-flow**:

* The `master` branch always contains stable code.
New features and bug fixes are implemented in `feature/*` branches and are merged to `develop` once they are finished.
* When a [new version is about to get released](release-management.md), the content of `develop` will be branched to `release/vX` (`X` is the new version number) and the translators get notified.
* Once the translation work and last minute bugfixing is done, `release/vX` is merged into `master` and a tag is created to mark the release. The last step of the release process is to merge `master` back into `develop` in order to update the translations and bugfixes in the active development branch.
* In rare and critical cases, hotfixes for the latest release will be created in the `master` branch and merged back to `develop`.

Still unclear? Click the player image above for a good explanation on YouTube!

## Git Commit Messages

Commits should start with a Capital letter and should be written in present tense (e.g. __:tada: Add cool new feature__ instead of __:tada: Added cool new feature__).
You should also start your commit message with **one** applicable emoji.
This does not only look great but also makes you rethink what to add to a commit. Make many but small commits!

Emoji | Description
------|------------
:tada: `:tada:` | When you added a cool new feature.
:wrench: `:wrench:` | When you added a piece of code.
:recycle: `:recycle:` | When you refactored a part of the code.
:sparkles: `:sparkles:` | When you applied clang-format.
:globe_with_meridians: `:globe_with_meridians:` | When you worked on translations.
:art: `:art:` | When you improved / added assets like themes.
:lipstick: `:lipstick:` | When you worked on the UI of the preferences dialog.
:rocket: `:rocket:` | When you improved performance.
:memo: `:memo:` | When you wrote documentation.
:beetle: `:beetle:` | When you fixed a bug.
:heavy_check_mark: `:heavy_check_mark:` | When you worked on checks or adjusted the code to be compliant with them.
:twisted_rightwards_arrows: `:twisted_rightwards_arrows:` | When you merged a branch.
:fire: `:fire:` | When you removed something.
:truck: `:truck:` | When you moved / renamed something.

<p align="center"><img src ="pics/hr.svg" /></p>

<p align="center">
  <a href="dbus-interface.md"><img src ="pics/left-arrow.png"/> The D-Bus Interface</a>
  <img src="pics/nav-space.svg"/>
  <a href="../README.md#getting-started"><img src ="pics/home.png"/> Index</a>
  <img src="pics/nav-space.svg"/>
  <a href="translating.md">Translating Fly-Pie <img src ="pics/right-arrow.png"/></a>
</p>
