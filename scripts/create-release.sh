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
# When the '-s' option is set, the script throws an error (instead of just a warning) when the
#   zip file is too big. This is necessary when uploading it to the GNOME Extensions website.
#   We think that the limit is 4096 KB, but we found no official documentation on this so far.

# Exit the script when one command fails.
set -e

# Go to the repo root.
cd "$( cd "$( dirname "$0" )" && pwd )/.." || \
  { echo "ERROR: Could not find the repo root."; exit 1; }

scripts/compile-locales.sh

# Delete any old zip and pack everything together
rm --force flypie@schneegans.github.com.zip
zip -r flypie@schneegans.github.com.zip -- src presets resources \
    schemas locale *.js metadata.json LICENSE


while getopts is FLAG; do
	case $FLAG in
		
		i)  # Install the extension
            # shellcheck disable=2015
            gnome-extensions install flypie@schneegans.github.com.zip --force && \
            echo "Successfully installed the application! Now restart the Shell ('Alt'+'F2', then 'r')." || \
            { echo "ERROR: Could not install the extension."; exit 1; };;

        s)  # We need to throw an error because of the zip size
            SIZE_ERROR="true";;

		*)	echo "ERROR: Invalid flag!"
            echo "Use '-i' to install the extension to your system. To just build it, run the script without any flag."
            echo "Use '-s' to throw an error when the zip size is too big to be uploaded to the Extensions website."
            exit 1;;
	esac
done

# Check zip file size
SIZE=$(stat -c %s flypie@schneegans.github.com.zip)

# If the zip is too big and a check is requested, throw an error. Otherwise just print a warning.
if [[ "$SIZE" -gt 4096000 ]]; then
    if [ "$SIZE_ERROR" = "true" ]; then
        echo "ERROR! The zip is too big to be uploaded to the Extensions website. Keep it smaller than 4096 KB!"
        exit 2
    else
        echo "WARNING! The zip is too big to be uploaded to the Extensions website. Keep it smaller than 4096 KB!"
    fi
fi
