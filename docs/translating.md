<!--
SPDX-FileCopyrightText: Simon Schneegans <code@simonschneegans.de>
SPDX-License-Identifier: CC-BY-4.0
-->

[![Translation status](https://hosted.weblate.org/widgets/fly-pie/-/horizontal-auto.svg)](https://hosted.weblate.org/engage/fly-pie/)

# Translating Fly-Pie

<img align="right" width="350px" src ="pics/achievements.jpg" />

A great way to contribute to Fly-Pie is creating a translation to another language! 

Just head over to [Weblate](https://hosted.weblate.org/engage/fly-pie/) and start a new translation or update an existing one.
If you are logged in, you can directly edit the translations.
If you are not logged in, you can make suggestions for improving existing translations.

An especially challenging part for translations are the **achievements**.
Most achievements have five tiers.
In these cases, you can use a `%i` or a `%s` in the achievement's name.
In English, `%i` will be replaced by the corresponding roman tier number (I, II, III, ...) and `%s` will be replaced by one of the attributes ('Novice', 'Master', ...).
Both of these can be translated as well, so you may get quite creative here!
The image on the right illustrates this.

<p style="clear:both"></p>


### Testing Your Translation

If you started a translation from scratch or modified substantial parts of an existing translation, you should verify that everything looks as supposed.
To do this, you should clone the [Weblate fork of Fly-Pie](https://github.com/weblate/Fly-Pie/tree/weblate-fly-pie-core) and install it:

```bash
git clone https://github.com/weblate/Fly-Pie.git
cd Fly-Pie
make install
```

Then, restart GNOME Shell with <kbd>Alt</kbd> + <kbd>F2</kbd>, <kbd>r</kbd> + <kbd>Enter</kbd>.
Or logout / login if you are on Wayland.
If all strings you translated are looking good, you're done!
A pull request including your changes will be created automatically.


<p align="center"><img src ="pics/hr.svg" /></p>

<p align="center">
  <a href="software-architecture.md"><img src ="pics/left-arrow.png"/> Software Architecture</a>
  <img src="pics/nav-space.svg"/>
  <a href="../README.md#getting-started"><img src ="pics/home.png"/> Index</a>
  <img src="pics/nav-space.svg"/>
  <a href="creating-actions.md">Creating New Action Types <img src ="pics/right-arrow.png"/></a>
</p>
