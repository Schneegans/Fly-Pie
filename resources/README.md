# License

All artwork in this directory can be used under the conditions of the CC0 public licence.

# Credits

Most of the icons in `img/scalable` are from the GNOME [icon development kit](https://gitlab.gnome.org/Teams/Design/icon-development-kit) (CC0).

# Videos

The videos in `video/` have been captured with the command below. Capturing starts after 2 seconds and automatically stops after 10 additional seconds.

```bash
sleep 2 && ffmpeg -y -hwaccel cuda -t 10 -f x11grab -r 30 -s 1920x1200 -draw_mouse 0 -i :0.0 -c:v libvpx -crf 10 -b:v 250k -vf "scale=480:300" video1.webm
```
