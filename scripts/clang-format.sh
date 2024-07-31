#!/bin/bash

# -------------------------------------------------------------------------------------- #
#                                 ___            _     ___                               #
#                                 |   |   \/    | ) |  |                                 #
#                             O-  |-  |   |  -  |   |  |-  -O                            #
#                                 |   |_  |     |   |  |_                                #
#                                                                                        #
# -------------------------------------------------------------------------------------- #

# SPDX-FileCopyrightText: Simon Schneegans <code@simonschneegans.de>
# SPDX-License-Identifier: MIT

# Exit the script when one command fails.
set -e

# Go to the repo root.
cd "$( cd "$( dirname "$0" )" && pwd )/.." || \
  { echo "ERROR: Could not find the repo root."; exit 1; }

# Execute clang format for all *.js.
find . -type f -name '*.js' -exec sh -c '
  for file do
    echo "Formatting $file..."
    clang-format -i "$file"
  done
' sh {} +
