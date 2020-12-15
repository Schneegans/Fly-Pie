#!/bin/bash

# -------------------------------------------------------------------------------------- #
#         ___            _     ___                                                       #
#         |   |   \/    | ) |  |             This software may be modified and distri-   #
#     O-  |-  |   |  -  |   |  |-  -O        buted under the terms of the MIT license.   #
#         |   |_  |     |   |  |_            See the LICENSE file for details.           #
#                                                                                        #
# -------------------------------------------------------------------------------------- #

# This script creates a new release of the Fly-Pie GNOME extension.
# When the '-i' option is set, it installs it to the system.

# Exit the script when one command fails.
set -e

# Go to the location of this script.
cd "$( cd "$( dirname "$0" )" && pwd )" || { echo "ERROR: Could not find the location of 'create-release.sh'."; exit 1; }

./compile-locales.sh

# Zip everything together
zip -r flypie@schneegans.github.com.zip -- common daemon presets resources \
    schemas settings locale *.js metadata.json changelog.md LICENSE

# Check whether the extension should be installed
while getopts i FLAG; do
	case $FLAG in
		
		i)  # shellcheck disable=2015
        gnome-extensions install flypie@schneegans.github.com.zip --force && \
        echo "Successfully installed the application! Now restart the Shell ('Alt'+'F2', then 'r')." || \
        { echo "ERROR: Could not install the extension."; exit 1; }
        rm flypie@schneegans.github.com.zip;;

		*)	echo "Invalid flag! Use '-i' to install the extension to your system. To just build it, run the script without any flag."
        exit 1;;
	esac
done
