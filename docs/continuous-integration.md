<p align="center"> 
  <img src ="pics/banner-03.jpg" />
</p>

# Continuous Integration

[Github Actions](https://github.com/Schneegans/Fly-Pie/actions) is used for continuous integration of Fly-Pie.
There are three workflow files used:

## [`checks.yml`](../.github/workflows/checks.yml)
This executes several checks whenever a commit is pushed or a pull request is opened.
* **Clang-Format Check:**
  We enforce specific code formatting rules described in the file [`.clang-format`](../.clang-format).
  For each and **every push event**, a job is executed which checks whether the code base obeys these rules.
  Commits passing this check will be marked with a :heavy_check_mark:, when the style does not match the rules, the commit will receive a :x:.
* **Comment Percentage Check:**
  For pull requests only, a job is run which analyses the amount of comments in the source tree.
  The percentage of source lines of code containing comments is calculated with the script [`cloc.sh`](../scripts/cloc.sh) and compared with the amount of comments in the base branch.
  This test will pass if the amount of comments did not decrease.
* **ShellCheck:** At each push event, all shell scripts are checked with ShellCheck.
* **Script Functionality:** Some scripts are tested whether they correctly return errors if some software is not installed.
* **Run Tests:** This checks whether the release archive can be created successfully. 
  It also checks whether the resulting archive is not too large to be uploaded to extensions.gnome.org. Then, several containers are booted (using [gnome-shell-pod](https://github.com/Schneegans/gnome-shell-pod)) to test Fly-Pie on various GNOME Shell versions.

## [`deploy.yml`](../.github/workflows/deploy.yml) 
This runs the [`create_release.sh`](../scripts/create-release.sh) script whenever a tag is pushed.
The resulting `flypie@schneegans.github.com.zip` is uploaded to an automatically created release.

## [`badges.yml`](../.github/workflows/badges.yml) 
This uses the [Dynamic Badges Action](https://github.com/Schneegans/dynamic-badges-action) to update the Comment-Percentage-Badge and Lines-of-Code-Badge of the `README.md` automatically whenever a commit is pushed.


<p align="center"><img src ="pics/hr.svg"/></p>

<p align="center">
  <img src="pics/nav-space.svg"/>
  <a href="release-management.md"><img src ="pics/left-arrow.png"/> Release Management</a>
  <img src="pics/nav-space.svg"/>
  <a href="../README.md#getting-started"><img src ="pics/home.png"/> Index</a>
  <img src="pics/nav-space.svg"/>
  <img src="pics/nav-space.svg"/>
  <img src="pics/nav-space.svg"/>
  <img src="pics/nav-space.svg"/>
  <img src="pics/nav-space.svg"/>
</p>
