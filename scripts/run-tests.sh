#!/bin/bash

# -------------------------------------------------------------------------------------- #
#         ___            _     ___                                                       #
#         |   |   \/    | ) |  |             This software may be modified and distri-   #
#     O-  |-  |   |  -  |   |  |-  -O        buted under the terms of the MIT license.   #
#         |   |_  |     |   |  |_            See the LICENSE file for details.           #
#                                                                                        #
# -------------------------------------------------------------------------------------- #

# This script executes several automated tests on Fly-Pie. To do this, Fly-Pie is
# installed in a container running GNOME Shell on xvfb.

# The GNOME Shell version can be supplied as first parameter. Currently 3.36, 3.38 and
# 40.0 are supported.
VERSION="${1:-3.38}"

# TODO: Check valid version.

# TODO: Check podman availability.

# Go to the repo root.
cd "$( cd "$( dirname "$0" )" && pwd )/.." || \
  { echo "ERROR: Could not find the repo root."; exit 1; }

# First compile the extension.
make release

# Run the container in detached mode.
podman pull ghcr.io/schneegans/gnome-shell:"$VERSION"
POD_ID=$(podman run --rm -td ghcr.io/schneegans/gnome-shell:"$VERSION")

# Wait some time to make sure that GNOME Shell has been started.
echo -n "Booting the container..."
sleep 3
echo " Done."

# Copy the extension to the container.
echo -n "Copy Fly-Pie to the container..."
podman cp flypie@schneegans.github.com.zip "$POD_ID":/home/gnomeshell/
echo " Done."

# Execute the install script. This installs the extension, restarts GNOME Shell and
# finally enables the extension.
echo -n "Installing Fly-Pie..."
podman exec --user gnomeshell "$POD_ID" /home/gnomeshell/set-env.sh /home/gnomeshell/enable-extension.sh flypie@schneegans.github.com
sleep 1
ERRORS=$(podman exec "$POD_ID" journalctl | grep flypie | grep ERROR)

if [ -n "$ERRORS" ]; then
  echo " Failed!"
  echo "$ERRORS"
  exit 1
else
 echo " Done."
fi


echo -n "Opening the preferences dialog of Fly-Pie..."
podman exec --user gnomeshell "$POD_ID" /home/gnomeshell/set-env.sh gnome-extensions prefs flypie@schneegans.github.com
sleep 2
ERRORS=$(podman exec "$POD_ID" journalctl | grep "Failed to open preferences")

if [ -n "$ERRORS" ]; then
  echo " Failed!"
  echo "$ERRORS"
  exit 1
else
 echo " Done."
fi

# Finally stop the container.
echo -n "Stopping the container..."
podman stop "$POD_ID" > /dev/null
echo " Done."
