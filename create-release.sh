#!/bin/bash

# -------------------------------------------------------------------------------------- #
#         ___            _     ___                                                       #
#         |   |   \/    | ) |  |             This software may be modified and distri-   #
#     O-  |-  |   |  -  |   |  |-  -O        buted under the terms of the MIT license.   #
#         |   |_  |     |   |  |_            See the LICENSE file for details.           #
#                                                                                        #
# -------------------------------------------------------------------------------------- #

# This script creates a new release of the Fly-Pie GNOME extension.

# Go to the location of this script.
cd "$( cd "$( dirname "$0" )" && pwd )" || { echo "ERROR: Could not find the location of 'create-release.sh'."; exit 1; }

./compile-locales.sh

# Zip everything together
zip -r flypie@schneegans.github.com.zip common daemon presets resources schemas settings locale && \
zip -r flypie@schneegans.github.com.zip -- *.js metadata.json *.md LICENSE
