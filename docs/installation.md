<p align="center">
  <img src ="pics/banner-01.jpg" />
</p>

# Installation

You can either install Fly-Pie from extensions.gnome.org (a), download a stable release
from GitHub (b) or clone the latest version directly with `git` (c).

## a) Installing from extensions.gnome.org

This is the most easy way to install Fly-Pie. Just head over to
[extensions.gnome.org](https://extensions.gnome.org/extension/3433/fly-pie) and flip the switch!
If you want to use a more up-to-date version of Fly-Pie, you can try one of the methods listed below.

## b) Downloading a Stable Release

Execute this command to download the latest stable release:

```bash
wget https://github.com/Schneegans/Fly-Pie/releases/latest/download/flypie@schneegans.github.com.zip
```

Install it by executing the following command. If you have Fly-Pie already installed and want to upgrade to
the latest version, append the `--force` flag in order to overwrite existing installs of Fly-Pie.

```bash
gnome-extensions install flypie@schneegans.github.com.zip
```

Then restart Gnome Shell with <kbd>Alt</kbd> + <kbd>F2</kbd>, <kbd>r</kbd> + <kbd>Enter</kbd>.
Or logout / login if you are on Wayland.
Then you can enable the extension with the *Gnome Tweak Tool*, the *Extensions* application or with this command:

```bash
gnome-extensions enable flypie@schneegans.github.com
```

## c) Cloning the Latest Version with `git`

```bash
cd ~/.local/share/gnome-shell/extensions
git clone https://github.com/Schneegans/Fly-Pie.git
mv Fly-Pie flypie@schneegans.github.com
```

You will have to compile the translations if you want to use Fly-Pie in your own language:

```bash
flypie@schneegans.github.com/scripts/compile-locales.sh
```

Then restart Gnome Shell with <kbd>Alt</kbd> + <kbd>F2</kbd>, <kbd>r</kbd> + <kbd>Enter</kbd>.
Or logout / login if you are on Wayland.
Then you can enable the extension with the *Gnome Tweak Tool*, the *Extensions* application or with this command:

```bash
gnome-extensions enable flypie@schneegans.github.com
```

<p align="center"><img src ="pics/hr.svg" /></p>

<p align="center">
  <img src="pics/nav-space.svg"/>
  <img src="pics/nav-space.svg"/>
  <img src="pics/nav-space.svg"/>
  <a href="../README.md#getting-started"><img src ="pics/home.png"/> Index</a>
  <img src="pics/nav-space.svg"/>
  <a href="first-steps.md">First Steps <img src ="pics/right-arrow.png"/></a>
</p>
