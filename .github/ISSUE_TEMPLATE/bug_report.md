---
# SPDX-FileCopyrightText: Simon Schneegans <code@simonschneegans.de>
# SPDX-License-Identifier: CC-BY-4.0

name: Bug Report
about: Create a report to help us improve Fly-Pie!
title: ''
labels: bug
assignees: ''
---

<!-- 
Note: If you have a question on how to use Fly-Pie, you can ask this question at the discussions board:
https://github.com/Schneegans/Fly-Pie/discussions?discussions_q=category%3A%22Fly-Pie+Q%26A%22
-->

## Describe the Bug
A clear and concise description of what the bug is.
If applicable, add screenshots to help explain your problem.

Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

You may also check the output of GNOME Shell for any error messages related to Fly-Pie.
This can be done with the following terminal command:

journalctl -f -o cat | grep -E 'flypie|'
```

## Expected Behavior
A clear and concise description of what you expected to happen.

## System
_Please complete the following information:_
 - Linux distribution [e.g. Ubuntu 20.04]
 - Fly-Pie version [e.g. Fly-Pie 3, or commit SHA]
 - GNOME Shell version: [e.g. 3.36.2]