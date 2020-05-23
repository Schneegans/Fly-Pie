<p align="center"> 
  <img src ="logo.svg" />
</p>

[![license](https://img.shields.io/badge/Gnome_Shell-3.36.2-blue.svg)](LICENSE)
[![license](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)
[![comments](https://img.shields.io/badge/Comments-17.4%25-green.svg)](cloc.sh)

journalctl /usr/bin/gnome-shell -f -o cat | grep gnomepie -B 2 -A 2
gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/shell/extensions/gnomepie2 --method org.gnome.Shell.Extensions.GnomePie2.ShowMenu '{"items":[{"name":"bar","icon":"user"},{"name":"horst","icon":"pixel"}]}'

# Contributing to Gnome-Pie 2

Whenever you encounter a :beetle: **bug** or have :tada: **feature request**, 
report this via [Github issues](https://github.com/schneegans/gnome-pie-2/issues).

We are happy to receive contributions to Gnome-Pie 2 in the form of **pull requests** via Github.
Feel free to fork the repository, implement your changes and create a merge request to the `develop` branch.

## Branching Guidelines

The development of Gnome-Pie 2 follows a simplified version of **git-flow**: The `master` branch always contains stable code.
New features and bug fixes are implemented in `feature/*` branches and are merged to `develop` once they are finished.
When a new milestone is reached, the content of `develop` will be merged to `master` and a tag is created.

### Git Commit Messages

Commits should start with a Capital letter and should be written in present tense (e.g. __:tada: Add cool new feature__ instead of __:tada: Added cool new feature__).
It's a great idea to start the commit message with an applicable emoji. This does not only look great but also makes you rethink what to add to a commit.
* :tada: `:tada:` when when adding a cool new feature
* :wrench: `:wrench:` when refactoring / improving a small piece of code
* :hammer: `:hammer:` when refactoring / improving large parts of the code
* :sparkles: `:sparkles:` when applying clang-format
* :art: `:art:` improving / adding assets like textures or 3D-models
* :rocket: `:rocket:` when improving performance
* :memo: `:memo:` when writing docs
* :beetle: `:beetle:` when fixing a bug
* :green_heart: `:green_heart:` when fixing the CI build
* :heavy_check_mark: `:heavy_check_mark:` when working on tests
* :arrow_up_small: `:arrow_up_small:` when adding / upgrading dependencies
* :arrow_down_small: `:arrow_down_small:` when removing / downgrading dependencies
* :twisted_rightwards_arrows: `:twisted_rightwards_arrows:` when merging branches
* :fire: `:fire:` when removing files
* :truck: `:truck:` when moving / renaming files or namespaces