[![license](https://img.shields.io/badge/Gnome_Shell-3.36.2-blue.svg)](LICENSE)
[![license](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)
[![comments](https://img.shields.io/badge/Comments-14.6%-green.svg)](cloc.sh)

journalctl /usr/bin/gnome-shell -f -o cat | grep gnomepie -B 2 -A 2
gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/shell/extensions/gnomepie2 --method org.gnome.Shell.Extensions.GnomePie2.ShowMenu '{"items":[{"name":"bar","icon":"user"},{"name":"horst","icon":"pixel"}]}'
