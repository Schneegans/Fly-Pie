#!/bin/bash

#////////////////////////////////////////////////////////////////////////////////////////#
#                                                                                        #
#     _____                    ___  _     ___       This software may be modified        #
#    / ___/__  ___  __ _  ___ / _ \(_)__ |_  |      and distributed under the            #
#   / (_ / _ \/ _ \/  ' \/ -_) ___/ / -_) __/       terms of the MIT license. See        #
#   \___/_//_/\___/_/_/_/\__/_/  /_/\__/____/       the LICENSE file for details.        #
#                                                                                        #
#////////////////////////////////////////////////////////////////////////////////////////#

# This scripts counts the lines of code and comments in all JavaScript files.
# The copyright-headers are substracted. It uses the commandline tool "cloc".
# All dumb comments like those /////////// or those // ------------ are also substracted.
# You can pass the --percentage-only flag to show only the percentage of code comments.

# Get the location of this script.
SCRIPT_DIR="$( cd "$( dirname "$0" )" && pwd )"

# Run cloc - this counts code lines, blank lines and comment lines for the specified
# languages. We are only interested in the summary, therefore the tail -1
SUMMARY="$(cloc "${SCRIPT_DIR}" --include-lang="JavaScript" --md | tail -1)"

# The $SUMMARY is one line of a markdown table and looks like this:
# SUM:|101|3123|2238|10783
# We use the following command to split it into an array.
IFS='|' read -r -a TOKENS <<< "$SUMMARY"

# Store the individual tokens for better readability.
NUMBER_OF_FILES=${TOKENS[1]}
COMMENT_LINES=${TOKENS[3]}
LINES_OF_CODE=${TOKENS[4]}

# To make the estimate of commented lines more accurate, we have to substract the
# copyright header which is included in each file. This header has the length of six
# lines. All dumb comments like those /////////// or those // ------------ are also
# substracted. As cloc does not count inline comments, the overall estimate should be
# rather conservative.
DUMB_COMMENTS="$(grep -r -E '//////|// -----' "${SCRIPT_DIR}" | wc -l)"
COMMENT_LINES=$(($COMMENT_LINES - 6 * $NUMBER_OF_FILES - $DUMB_COMMENTS))

# Print results.
if [[ $* == *--percentage-only* ]]
then
  awk -v a=$COMMENT_LINES -v b=$LINES_OF_CODE \
      'BEGIN {printf "%3.1f\n", 100*a/b}'
else
  awk -v a=$LINES_OF_CODE \
      'BEGIN {printf "Lines of source code: %6.1fk\n", a/1000}'
  awk -v a=$COMMENT_LINES \
      'BEGIN {printf "Lines of comments:    %6.1fk\n", a/1000}'
fi