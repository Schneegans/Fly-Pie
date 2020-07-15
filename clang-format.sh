#!/bin/bash

# -------------------------------------------------------------------------------------- #
#    _____       _             _____ _                                                   #
#   |   __|_ _ _|_|___ ___ ___|  _  |_|___   This software may be modified and distri-   #
#   |__   | | | | |   | . |___|   __| | -_|  buted under the terms of the MIT license.   #
#   |_____|_____|_|_|_|_  |   |__|  |_|___|  See the LICENSE file for details.           #
#                     |___|                                                              #
# -------------------------------------------------------------------------------------- #

# Get the location of this script.
SRC_DIR="$( cd "$( dirname "$0" )" && pwd )"

# Execute clang format for all *.cpp, *.hpp and *.inl files.
find $SRC_DIR -type f -name '*.js' -exec sh -c '
  for file do
    echo "Formatting $file..."
    clang-format -i "$file"
  done
' sh {} +
