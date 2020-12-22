#!/bin/bash

# -------------------------------------------------------------------------------------- #
#         ___            _     ___                                                       #
#         |   |   \/    | ) |  |             This software may be modified and distri-   #
#     O-  |-  |   |  -  |   |  |-  -O        buted under the terms of the MIT license.   #
#         |   |_  |     |   |  |_            See the LICENSE file for details.           #
#                                                                                        #
# -------------------------------------------------------------------------------------- #

# This script takes 'po/flypie.pot' and compiles the latest '.po' file from it.
# Usage: update-po.sh <LANG-CODE>, where <LANG-CODE> is the language code of the file
# you want to update. Pass 'all' to update all '.po' files.

if ! command -v msgmerge &> /dev/null
then
  echo "ERROR: Could not find msgmerge. On Ubuntu based systems, check if the gettext package is installed!"
  exit 1
fi

# Get to the location of this script.
FLYPIE="$( cd "$( dirname "$0" )" && pwd )"
cd "$FLYPIE" || \
  { echo "ERROR: Could not cd to the script's location!"; exit 1; }

while getopts l:a FLAG; do
  case $FLAG in

    l)  # Update one specific '.po' file.
        # Check if a valid language code was passed.
        if test -f po/"$OPTARG".po; then
          echo -n "Updating '$OPTARG.po' "
          msgmerge -U po/"$OPTARG".po po/flypie.pot

          # Check if the translation got fuzzy. This happens when an already translated string
          # got changed in the source code. Does not detect untranslated strings!
          if grep --silent "#, fuzzy" po/"$OPTARG".po; then
            echo "WARNING: The translation has unclear strings and needs an update."
          fi
          exit
        else
          echo "ERROR: The translation '$OPTARG' does not exist. Feel free to create one!"
          exit 1
        fi;;

    a)  # Update all '.po' files.
        for FILE in po/*.po; do
          # handle the case of no .po files, see SC2045
          [[ -e "$FILE" ]] || { echo "ERROR: No .po files found, exiting."; exit 1; }
          echo -n "Updating '$FILE' "
          msgmerge -U "$FILE" po/flypie.pot

          # Check if the translation got fuzzy. This happens when an already translated string
          # got changed in the source code. Does not detect untranslated strings!
          if grep --silent "#, fuzzy" "$FILE"; then
            FUZZY+=("$FILE")
          fi
        done

        # Display a warning if any translation needs an update.
        if [[ -v FUZZY ]]; then
          echo "WARNING: Some translations have unclear strings and need an update: ${FUZZY[*]}"
        fi
        exit;;

    *)  # Handle invalid flags.
        echo "ERROR: Invalid flag!"
        echo "Use '-l <LANG-CODE>' to update a specific '.po' file."
        echo "Use '-a' to update all '.po' files."
        exit 1;;
  esac
done

# In case no flag was specified
echo "ERROR: You need to specify a flag!"
echo "Use '-l <LANG-CODE>' to update a specific '.po' file."
echo "Use '-a' to update all '.po' files."
exit 1
