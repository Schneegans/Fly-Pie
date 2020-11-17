#!/bin/bash

# -------------------------------------------------------------------------------------- #
#         ___            _     ___                                                       #
#         |   |   \/    | ) |  |             This software may be modified and distri-   #
#     O-  |-  |   |  -  |   |  |-  -O        buted under the terms of the MIT license.   #
#         |   |_  |     |   |  |_            See the LICENSE file for details.           #
#                                                                                        #
# -------------------------------------------------------------------------------------- #

# This script scans the source code of Fly-Pie for any translatable string and updates
# the po/flypie.pot file accordingly. The new strings are than merged with all existing
# translations.

# Check if all necessary commands are available.
if ! command -v xgettext &> /dev/null
then
  echo "ERROR: Could not find xgettext. On Ubuntu based systems, check if the gettext package is installed!"
  exit 1
elif ! command -v msgmerge &> /dev/null
then
  echo "ERROR: Could not find msgmerge. On Ubuntu based systems, check if the gettext package is installed!"
  exit 1
fi

# Get to the location of this script.
FLYPIE="$( cd "$( dirname "$0" )" && pwd )"
cd "$FLYPIE" || { echo "ERROR: Could not cd to the script's location!"; exit 1; } # See SC2164

# First update the template file with the strings from the source tree.
xgettext --from-code=UTF-8 --output=po/flypie.pot settings/settings.ui */*.js 

# Then update all *.po files.
for FILE in $(ls po/*.po)
do
  echo -n "Updating '$FILE' "
  msgmerge -U "$FILE" po/flypie.pot
done

echo "All done!"