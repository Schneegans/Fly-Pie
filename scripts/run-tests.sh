#!/bin/bash

# -------------------------------------------------------------------------------------- #
#         ___            _     ___                                                       #
#         |   |   \/    | ) |  |             This software may be modified and distri-   #
#     O-  |-  |   |  -  |   |  |-  -O        buted under the terms of the MIT license.   #
#         |   |_  |     |   |  |_            See the LICENSE file for details.           #
#                                                                                        #
# -------------------------------------------------------------------------------------- #

# Exit the script when one command fails.
set -e

# The version can be supplied as first parameter.
VERSION="${1:-3.38}"

# TODO: Check valid version.

# TODO: Check podman availability.

# Go to the repo root.
cd "$( cd "$( dirname "$0" )" && pwd )/.." || \
  { echo "ERROR: Could not find the repo root."; exit 1; }

# Compile the extension.
scripts/create-release.sh -s

# Run the container in detached mode.
podman pull ghcr.io/schneegans/gnome-shell-"$VERSION":latest
POD_ID=$(podman run --rm -td ghcr.io/schneegans/gnome-shell-"$VERSION":latest)

# Wait some time to make sure that GNOME Shell has been started.
sleep 10

# Copy the archive to the container.
podman cp flypie@schneegans.github.com.zip "$POD_ID":/home/gnomeshell/

# Execute the install script. This installs the extension, restarts GNOME Shell and
# finally enables the extension.
podman exec --user gnomeshell "$POD_ID" /home/gnomeshell/set-env.sh /home/gnomeshell/enable-extension.sh flypie@schneegans.github.com

# Wait some time to make sure that GNOME Shell has been restarted.
sleep 3

podman exec --user gnomeshell "$POD_ID" /home/gnomeshell/set-env.sh gnome-extensions prefs flypie@schneegans.github.com
sleep 2

# podman exec --env DISPLAY=:99 --user gnomeshell "$POD_ID" xdotool key ctrl+space
# sleep 1
# podman exec --env DISPLAY=:99 --user gnomeshell "$POD_ID" xdotool key ctrl+space
# sleep 1

# Then make a "screenshot" and display the image.
podman cp "$POD_ID":/home/gnomeshell/Xvfb_screen0 . && convert xwd:Xvfb_screen0 capture.jpg

# Finally stop the container.
podman stop "$POD_ID"