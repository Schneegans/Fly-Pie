#!/bin/bash

# -------------------------------------------------------------------------------------- #
#         ___            _     ___                                                       #
#         |   |   \/    | ) |  |             This software may be modified and distri-   #
#     O-  |-  |   |  -  |   |  |-  -O        buted under the terms of the MIT license.   #
#         |   |_  |     |   |  |_            See the LICENSE file for details.           #
#                                                                                        #
# -------------------------------------------------------------------------------------- #

# This script creates a new release of the Fly-Pie GNOME extension.

./compile-locales.sh
mkdir flypie@schneegans.github.com
mv common daemon presets resources schemas settings locale flypie@schneegans.github.com
mv -- *.js metadata.json *.md LICENSE flypie@schneegans.github.com
zip -r flypie@schneegans.github.com.zip flypie@schneegans.github.com