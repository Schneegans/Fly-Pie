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

# Get the location of this script.
FLYPIE="$( cd "$( dirname "$0" )" && pwd )"
# Check if all necessary commands are available
if ! which msgfmt; then
  echo "ERROR: Could not find msgfmt. On Ubuntu based systems, check if the gettext package is installed!"
  exit 1
fi

for FILE in `ls $FLYPIE/po/*.po`
do
  # Extract the language code from the filename.
  LANGUAGE="${FILE##*/}"
  LANGUAGE="${LANGUAGE%.*}"

  # Compile the corresponding *.mo file.
  echo "Creating localization for '$LANGUAGE'..."
  mkdir -p $FLYPIE/locale/$LANGUAGE/LC_MESSAGES
  msgfmt $FILE -o $FLYPIE/locale/$LANGUAGE/LC_MESSAGES/flypie.mo
done

echo "All done!"