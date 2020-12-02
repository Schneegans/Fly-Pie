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

# Get the location of this script.
SRC_DIR="$( cd "$( dirname "$0" )" && pwd )"

# Execute clang format for all *.cpp, *.hpp and *.inl files.
find "$SRC_DIR" -type f -name '*.js' -exec sh -c '
  for file do
    echo "Formatting $file..."
    clang-format -i "$file"
  done
' sh {} +
