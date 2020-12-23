#!/bin/bash

# -------------------------------------------------------------------------------------- #
#         ___            _     ___                                                       #
#         |   |   \/    | ) |  |             This software may be modified and distri-   #
#     O-  |-  |   |  -  |   |  |-  -O        buted under the terms of the MIT license.   #
#         |   |_  |     |   |  |_            See the LICENSE file for details.           #
#                                                                                        #
# -------------------------------------------------------------------------------------- #

# This script creates a compiled *.mo translation file for each *.po file in the 'po'
# directory. It is necessary to run this script whenever a translation has been changed.

# Exit the script when one command fails.
set -e

# Check if all necessary commands are available.
if ! command -v msgfmt &> /dev/null
then
  echo "ERROR: Could not find msgfmt. On Ubuntu based systems, check if the gettext package is installed!"
  exit 1
fi

# Go to the repo root.
cd "$( cd "$( dirname "$0" )" && pwd )/.." || \
  { echo "ERROR: Could not find the repo root."; exit 1; }

for FILE in po/*.po
do
  # handle the case of no .po files, see SC2045
  [[ -e "$FILE" ]] || { echo "ERROR: No .po files found, exiting."; exit 1; }
  # Extract the language code from the filename.
  LANGUAGE="${FILE##*/}"
  LANGUAGE="${LANGUAGE%.*}"

  # Compile the corresponding *.mo file.
  echo "Creating localization for '$LANGUAGE'..."
  mkdir -p locale/"$LANGUAGE"/LC_MESSAGES
  msgfmt "$FILE" -o locale/"$LANGUAGE"/LC_MESSAGES/flypie.mo
done

echo "All done!"
