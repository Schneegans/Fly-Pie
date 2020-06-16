<p align="center"> 
  <img src ="logo.svg" />
</p>

[![license](https://img.shields.io/badge/Gnome_Shell-3.36.2-blue.svg)](LICENSE)
[![license](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)
[![comments](https://img.shields.io/badge/Comments-28.3%25-green.svg)](cloc.sh)

```bash
journalctl /usr/bin/gnome-shell -f -o cat | grep swingpie -B 2 -A 2
gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/shell/extensions/swingpie --method org.gnome.Shell.Extensions.swingpie.ShowMenu '{"items":[{"name":"bar","icon":"user"},{"name":"horst","icon":"pixel"}]}'
```

# Contributing to Swing-Pie

Whenever you encounter a :beetle: **bug** or have :tada: **feature request**, 
report this via [Github issues](https://github.com/schneegans/swingpie/issues).

We are happy to receive contributions to Swing-Pie in the form of **pull requests** via Github.
Feel free to fork the repository, implement your changes and create a merge request to the `develop` branch.

## Branching Guidelines

The development of Swing-Pie follows a simplified version of **git-flow**: The `master` branch always contains stable code.
New features and bug fixes are implemented in `feature/*` branches and are merged to `develop` once they are finished.
When a new milestone is reached, the content of `develop` will be merged to `master` and a tag is created.

### Git Commit Messages

Commits should start with a Capital letter and should be written in present tense (e.g. __:tada: Add cool new feature__ instead of __:tada: Added cool new feature__).
It's a great idea to start the commit message with an applicable emoji. This does not only look great but also makes you rethink what to add to a commit.

Emoji | Description
------|------------
:tada: `:tada:` | Added a cool new feature
:wrench: `:wrench:` | Refactored / improved a small piece of code
:hammer: `:hammer:` | Refactored / improved large parts of the code
:sparkles: `:sparkles:` | Applied clang-format
:art: `:art:` | Improved / added assets like themes
:rocket: `:rocket:` | Improved performance
:memo: `:memo:` | Wrote documentation
:beetle: `:beetle:` | Fixed a bug
:twisted_rightwards_arrows: `:twisted_rightwards_arrows:` | Merged a branch
:fire: `:fire:` | Removed something
:truck: `:truck:` | Moved / renamed something