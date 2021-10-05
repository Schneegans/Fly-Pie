<p align="center">
  <img src ="pics/banner-06.jpg" />
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

Then restart GNOME Shell with <kbd>Alt</kbd> + <kbd>F2</kbd>, <kbd>r</kbd> + <kbd>Enter</kbd>.
Or logout / login if you are on Wayland.
Then you can enable the extension with the *Gnome Tweak Tool*, the *Extensions* application or with this command:

```bash
gnome-extensions enable flypie@schneegans.github.com
```

## c) Cloning the Latest Version with `git`

You should **not** clone Fly-Pie directly to the `~/.local/share/gnome-shell/extensions` directory as this may get overridden occasionally!
Execute the clone command below where you want to have the source code of Fly-Pie.

```bash
git clone https://github.com/Schneegans/Fly-Pie.git
cd Fly-Pie
```

Now you will have to install the extension.
The `make` command below compiles the locales, schemas and resources, creates a zip file of the extension and finally installs it with the `gnome-extensions` tool.

```bash
make install
```

Then restart GNOME Shell with <kbd>Alt</kbd> + <kbd>F2</kbd>, <kbd>r</kbd> + <kbd>Enter</kbd>.
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
