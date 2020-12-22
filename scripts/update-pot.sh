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
# run update-po.sh <LANG-CODE>.

# Exit the script when one command fails.
set -e

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
xgettext --from-code=UTF-8 --add-comments=Translators \
         --output=po/flypie.pot settings/settings.ui ./*/*.js ./*/*/*.js 

echo "All done!"
