#!/bin/bash

# -------------------------------------------------------------------------------------- #
#         ___            _     ___                                                       #
#         |   |   \/    | ) |  |             This software may be modified and distri-   #
#     O-  |-  |   |  -  |   |  |-  -O        buted under the terms of the MIT license.   #
#         |   |_  |     |   |  |_            See the LICENSE file for details.           #
#                                                                                        #
# -------------------------------------------------------------------------------------- #

# This script scans the source code of Fly-Pie for any translatable strings and updates
# the po/flypie.pot file accordingly. To merge the new strings into a translation,
# run update-po.sh -l <LANG-CODE>.

# Exit the script when one command fails.
set -e

echo "Generating 'flypie.pot'..."

# Check if all necessary commands are available.
if ! command -v xgettext &> /dev/null
then
  echo "ERROR: Could not find xgettext. On Ubuntu based systems, check if the gettext package is installed!"
  exit 1
fi

# Go to the repo root.
cd "$( cd "$( dirname "$0" )" && pwd )/.." || \
  { echo "ERROR: Could not find the repo root."; exit 1; }

# Update the template file with the strings from the source tree. All preceeding
# comments starting with 'Translators' will be extracted as well.
xgettext --from-code=UTF-8 \
         --add-comments=Translators \
         --copyright-holder="Simon Schneegans" \
         --package-name="Fly-Pie" \
         --package-version="6" \
         --output=po/flypie.pot \
         resources/ui/*.ui ./*/*/*.js ./*/*/*/*.js 

# Replace some lines of the header with our own.
sed -i '1s/.*/# <LANGUAGE> translation for the Fly-Pie GNOME Shell Extension./' po/flypie.pot
sed -i "2s/.*/# Copyright (C) $(date +%Y) Simon Schneegans/" po/flypie.pot
sed -i "4s/.*/# <FIRSTNAME LASTNAME <EMAIL@ADDRESS>, $(date +%Y)./" po/flypie.pot
sed -i '12s/.*/"PO-Revision-Date: <YYYY-MM-DD> <HM:MM+TIMEZONE>\\n"/' po/flypie.pot
sed -i '14s/.*/"Language-Team: \\n"/' po/flypie.pot
sed -i '15s/.*/"Language: <LANGUAGE_CODE>\\n"/' po/flypie.pot

echo "'flypie.pot' generated!"
