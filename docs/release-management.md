<p align="center"> 
  <img src ="pics/banner-07.jpg" />
</p>

# Releases of Fly-Pie

Releases are [published on Github](https://github.com/Schneegans/Fly-Pie/releases).
They are automatically created via [Github Actions](https://github.com/Schneegans/Fly-Pie/actions) whenever a git tag is pushed.
The progress of future releases is tracked with [Github Milestones](https://github.com/Schneegans/Fly-Pie/milestones).
Submitted [issues](https://github.com/Schneegans/Fly-Pie/issues) will be assigned to a specific release (depending on their importance and complexity).

## Version Numbers

GNOME Shell extensions [should use integer numbers for their versioning](https://wiki.gnome.org/Projects/GnomeShell/Extensions/Writing#metadata.json_.28Required.29).
Therefore the version number of Fly-Pie will be increased by one whenever a new version is released.

## Creating Releases

When a new version of Fly-Pie is released, the following steps are performed.

1. We base the following steps on the current `main` branch:
   ```bash
   git checkout main
   ```

1. First, the release date in the [changelog.md](https://github.com/Schneegans/Fly-Pie/blob/main/docs/changelog.md) needs to be updated.
When this is done, the file has to be committed:
   ```bash
   git add docs/changelog.md
   git commit -m ":tada: Set release date"
   ```

1. Then, a tag is created and everything is pushed:
   ```bash
   git tag v<new version number>
   git push origin v<new version number>
   git push origin main
   ```

1. Finally, the version number of the `metadata.json` needs to be increased for the next release.
   ```bash
   git add metadata.json
   git commit -m ":tada: Bump version number"
   ```

1. Last but not least, the [automatically created release](https://github.com/Schneegans/Fly-Pie/releases) needs to be renamed and an interesting description needs to be added.

1. Ultimately, the created `flypie@schneegans.github.com.zip` file is uploaded to https://extensions.gnome.org/. It will take some time to get reviewed there.

<p align="center"><img src ="pics/hr.svg"/></p>

<p align="center">
  <img src="pics/nav-space.svg"/>
  <a href="changelog.md"><img src ="pics/left-arrow.png"/> Changelog</a>
  <img src="pics/nav-space.svg"/>
  <a href="../README.md#getting-started"><img src ="pics/home.png"/> Index</a>
  <img src="pics/nav-space.svg"/>
  <a href="continuous-integration.md">Continuous Integration <img src ="pics/right-arrow.png"/></a>
</p>
