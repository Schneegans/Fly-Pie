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

usage() {
  echo "Usage: $0 -v fedora_version -s session" >&2
}

# 32, 33, 34, 35, 36
FEDORA_VERSION=33

# gnome-wayland-nested
SESSION="gnome-xsession"

while getopts "v:s:h" opt; do
  case $opt in
    v) FEDORA_VERSION="${OPTARG}";;
    s) SESSION="${OPTARG}";;
    h) usage; exit 0;;
    *) usage; exit 1;;
  esac
done

# Go to the repo root.
cd "$( cd "$( dirname "$0" )" && pwd )/.." || \
  { echo "ERROR: Could not find the repo root."; exit 1; }

IMAGE="ghcr.io/schneegans/gnome-shell-pod-${FEDORA_VERSION}"
EXTENSION="flypie@schneegans.github.com"

POD=$(podman run --rm --cap-add=SYS_NICE --cap-add=IPC_LOCK -td "${IMAGE}")

down() {
  podman kill "${POD}"
  wait
}

trap down INT TERM EXIT

do_in_pod() {
  podman exec --user gnomeshell --workdir /home/gnomeshell "${POD}" set-env.sh "$@"
}

find_target() {
  POS=$(do_in_pod find-target.sh "${1}")
  if [[ -z "${POS}" ]]; then
    echo "${2}"
    podman cp "${POD}:/opt/Xvfb_screen0" - | tar xf - --to-command 'convert xwd:- fail.png'
    LOG=$(do_in_pod sudo journalctl | grep -C 5 "flypie\|error\|gjs")
    echo "$LOG" > fail.log
    exit 1
  fi
}

echo "Waiting for D-Bus..."
do_in_pod wait-user-bus.sh > /dev/null 2>&1

if [[ "${FEDORA_VERSION}" -gt 33 ]]; then
  echo "Disabling welcome tour..."
  do_in_pod gsettings set org.gnome.shell welcome-dialog-last-shown-version "999" || true
fi

echo "Installing extension..."
podman cp "tests/references" "${POD}:/home/gnomeshell/references"
podman cp "${EXTENSION}.zip" "${POD}:/home/gnomeshell"
do_in_pod gnome-extensions install "${EXTENSION}.zip"
do_in_pod gnome-extensions enable "${EXTENSION}"

echo "Starting $(do_in_pod gnome-shell --version)..."
do_in_pod systemctl --user start "${SESSION}@:99"
sleep 10

if [[ "${FEDORA_VERSION}" -gt 33 ]]; then
  echo "Closing Overview..."
  do_in_pod xdotool keydown "super"
  sleep 0.5
  do_in_pod xdotool keyup "super"
  sleep 3
fi

echo "Opening Preferences..."
do_in_pod gnome-extensions prefs "${EXTENSION}"
sleep 3
find_target "references/preferences.png" "Failed to open preferences!"

echo "Opening Default Menu..."
do_in_pod xdotool keydown "ctrl+space"
sleep 0.5
do_in_pod xdotool keyup "ctrl+space"
sleep 3
find_target "references/default_menu.png" "Failed to open default menu!"

do_in_pod move-mouse-to-target.sh "references/default_menu.png"
do_in_pod xdotool click 1
sleep 2

podman cp "${POD}:/opt/Xvfb_screen0" - | tar xf - --to-command 'convert xwd:- result.png'
echo "All tests executed successfully."

