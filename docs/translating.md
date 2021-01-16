<p align="center">
  <img src ="pics/banner-07.jpg" />
</p>

# Translating Fly-Pie

A great way to contribute to Fly-Pie is creating a translation to another language!

* Start by generating the latest translation file with the following command:

  ```bash
  scripts/update-po.sh -l <LANG-CODE> # <LANG-CODE>` is the language code for the
                                      # translation (`de` for German, `it` for Italian etc.)
  ```

* In case you are the first translator to a language, this script should create a `.po` file for you.
Otherwise, it pulls the latest strings and merges them into the existing translation file.
Translations of Fly-Pie are stored in the `po/` directory.

* Open the file and start translating! We suggest using a tool like
[Poedit](https://poedit.net/) or the [GNOME Translation Editor](https://wiki.gnome.org/Apps/Gtranslator).

* Once you are happy to test your translation, save it as `<LANG-CODE>.po` file
in the `/po` directory and install the extension with your updated translations:

  ```bash
  scripts/create-release.sh -i
  ```

* Then, restart GNOME Shell with <kbd>Alt</kbd> + <kbd>F2</kbd>, <kbd>r</kbd> + <kbd>Enter</kbd>.
Or logout / login if you are on Wayland.

* Test if all strings you translated are looking good.
Then, you can add your new `*.po` file with a commit like `:globe_with_meridians: <Add/Update> <Language> translation`
and submit a pull request to the `develop` branch!

**To get started, have a look at the [Pull Request Template](.github/PULL_REQUEST_TEMPLATE/add_or_update_translation.md)**.
It provides a guideline on what to do in order to get your Pull Request accepted.
When creating your pull request, you can simply append a `&template=add_or_update_translation.md`
to the URL to auto-populate the body of your pull request with the template.

Please refer to [contributing.md](contributing.md) for the some further contribution guidelines.

**Note:**
You may need to install the `gettext` package in order to compile the translations.
In Ubuntu, it can be installed by running the following command:

```bash
sudo apt install gettext
```

<p align="center"><img src ="pics/hr.svg" /></p>

<p align="center">
  <a href="software-architecture.md"><img src ="pics/left-arrow.png"/> Software Architecture</a>
  <img src="pics/nav-space.svg"/>
  <a href="../README.md#getting-started"><img src ="pics/home.png"/> Index</a>
  <img src="pics/nav-space.svg"/>
  <a href="creating-actions.md">Creating New Action Types <img src ="pics/right-arrow.png"/></a>
</p>
