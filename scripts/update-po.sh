#!/bin/bash

# -------------------------------------------------------------------------------------- #
#         ___            _     ___                                                       #
#         |   |   \/    | ) |  |             This software may be modified and distri-   #
#     O-  |-  |   |  -  |   |  |-  -O        buted under the terms of the MIT license.   #
#         |   |_  |     |   |  |_            See the LICENSE file for details.           #
#                                                                                        #
# -------------------------------------------------------------------------------------- #

# This script takes 'po/flypie.pot' and compiles the latest '.po' file from it.
# Usage: update-po.sh -l <LANG-CODE>, where <LANG-CODE> is the language code of the file
# you want to update. Pass '-a' to update all '.po' files.

# Print usage info
usage() {
  echo "Use '-l <LANG-CODE>' to update a specific '.po' file."
  echo "Use '-a' to update all '.po' files."
}

# Create a new translation from 'flypie.pot'. Do not update the template because
# of potential merge conflicts. This is done in a seperate step.
promptNewTranslation() {
  echo -n "The translation for '$1' does not exist. Do you want to create it? [Y/n] "
  read -r reply

  # Default to 'Yes' when no answer given
  if [ -z "$reply" ] || [ "$reply" = "Y" ] ||  [ "$reply" = "y" ]; then
    msginit --input=po/flypie.pot --locale="$1" --output-file="po/$1.po"
    # Replace lines to match our template
    sed -i "2s/.*/# Copyright (C) $(date +%Y) Simon Schneegans/" po/"$1".po
    sed -i "4s/.*/# <FIRSTNAME LASTNAME <EMAIL@ADDRESS>, $(date +%Y)./" po/"$1".po
    sed -i '13s/.*/"Language-Team: \\n"/' po/"$1".po
    sed -i '15s/.*/"Language: <LANGUAGE_CODE>\\n"/' po/"$1".po
  fi
}


if ! command -v msgmerge &> /dev/null
then
  echo "ERROR: Could not find msgmerge. On Ubuntu based systems, check if the gettext package is installed!"
  exit 1
fi

# Go to the repo root.
cd "$( cd "$( dirname "$0" )" && pwd )/.." || \
  { echo "ERROR: Could not find the repo root."; exit 1; }

while getopts l:a FLAG; do
  case $FLAG in

    l)  # Update/Create one specific '.po' file.
        # Check if a valid language code was passed.
        if test -f po/"$OPTARG".po; then
          echo -n "Updating '$OPTARG.po' "
          msgmerge --previous -U po/"$OPTARG".po po/flypie.pot

          # Check the state of the translation progress.
          # We don't want to actually create a .mo file, so we direct it to /dev/null.
          msgfmt --check --verbose --output-file=/dev/null po/"$OPTARG".po
          exit
        else
          promptNewTranslation "$OPTARG"
          exit
        fi;;

    a)  # Update all '.po' files.
        for FILE in po/*.po; do
          # handle the case of no .po files, see SC2045
          [[ -e "$FILE" ]] || { echo "ERROR: No .po files found, exiting."; exit 1; }
          echo -n "Updating '$FILE' "
          msgmerge --previous -U "$FILE" po/flypie.pot

          # Check the state of the translation progress.
          # We don't want to actually create a .mo file, so we direct it to /dev/null.
          msgfmt --check --verbose --output-file=/dev/null po/"$OPTARG".po
        done
        exit;;

    *)  # Handle invalid flags.
        echo "ERROR: Invalid flag!"
        usage
        exit 1;;
  esac
done

# In case no flag was specified
echo "ERROR: You need to specify a flag!"
usage
exit 1
