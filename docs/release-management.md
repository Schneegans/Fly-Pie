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

1. We base the following steps on the current develop branch:
   ```bash
   git checkout develop
   ```
2. First the translation template is updated:
   ```bash
   make pot
   git add po/flypie.pot
   git commit -m ":globe_with_meridians: Update translation template"
   ```

3. Then the [changelog.md](https://github.com/Schneegans/Fly-Pie/blob/develop/docs/changelog.md) has to be updated.
Based on the commits since the last release and the completed milestone, a list of changes is compiled.
When this is done, the file has to be committed:
   ```bash
   git add docs/changelog.md
   git commit -m ":memo: Update changelog.md"
   git push origin develop
   ```

4. Then a `release` branch is created:
   ```bash
   git checkout -b release/v<new version number>
   git push origin release/v<new version number>
   ```

5. Then all translators need to be notified.
To do this, a new issue is created with a checklist with all translations which need an update and the corresponding @-mentions.
Also, last-minute bug fixes should be implemented now.

6. Next, the `release` branch is merged to `main`, deleted, and a tag is created and everything is pushed:
   ```bash
   git checkout main
   git merge feature/v<new version number>
   git tag v<new version number>
   git push origin v<new version number>
   git push origin main
   git push origin :feature/v<new version number>
   git branch -d feature/v<new version number>
   git checkout develop
   git pull origin develop
   git merge main
   git push origin develop
   ```

7. Finally, the version number of the `metadata.json` needs to be increased for the next release.
   ```bash
   git add metadata.json
   git commit -m ":tada: Bump version number"
   ```

8. Last but not least, the [automatically created release](https://github.com/Schneegans/Fly-Pie/releases) needs to be renamed and an interesting description needs to be added.

9. Ultimately, the created `flypie@schneegans.github.com.zip` file is uploaded to https://extensions.gnome.org/. It will take some time to get reviewed there.

<p align="center"><img src ="pics/hr.svg"/></p>

<p align="center">
  <img src="pics/nav-space.svg"/>
  <a href="changelog.md"><img src ="pics/left-arrow.png"/> Changelog</a>
  <img src="pics/nav-space.svg"/>
  <a href="../README.md#getting-started"><img src ="pics/home.png"/> Index</a>
  <img src="pics/nav-space.svg"/>
  <a href="continuous-integration.md">Continuous Integration <img src ="pics/right-arrow.png"/></a>
</p>
