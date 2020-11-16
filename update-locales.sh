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

# Get to the location of this script.
FLYPIE="$( cd "$( dirname "$0" )" && pwd )"
cd $FLYPIE

# First update the template file with the strings from the source tree.
xgettext --from-code=UTF-8 --output=po/flypie.pot settings/settings.ui */*.js 

# Then update all *.po files.
for FILE in `ls po/*.po`
do
  echo -n "Updating '$FILE' "
  msgmerge -U $FILE po/flypie.pot
done

echo "All done!"