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

# Exit the script when one command fails.
set -e

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

# First update the template file with the strings from the source tree. All preceeding
# comments starting with 'Translators' will be extracted as well.
xgettext --from-code=UTF-8 --add-comments=Translators \
         --output=po/flypie.pot resources/settings.ui ./*/*/*.js ./*/*/*/*.js 

# Then update all *.po files.
for FILE in po/*.po
do
  # handle the case of no .po files, see SC2045
  [[ -e "$FILE" ]] || { echo "ERROR: No .po files found, exiting."; exit 1; }
  echo -n "Updating '$FILE' "
  msgmerge -U "$FILE" po/flypie.pot

  # Check if the translation got fuzzy.
  if grep --silent "#, fuzzy" "$FILE"; then
    FUZZY+=("$FILE")
  fi
done

# Display a warning if any translation needs an update.
if [[ -v FUZZY ]]; then
  echo "WARNING: Some translations have unclear strings and need an update: ${FUZZY[*]}"
fi

echo "All done!"
