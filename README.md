journalctl /usr/bin/gnome-shell -f -o cat | grep gnomepie -B 2 -A 2
gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/shell/extensions/gnomepie2 --method org.gnome.Shell.Extensions.GnomePie2.ShowMenu '{"name":"foo","icon":"link","subs":[{"name":"bar","icon":"user"},{"name":"horst","icon":"pixel"}]}'
