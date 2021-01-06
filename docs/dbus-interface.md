# Fly-Pie's D-Bus Interface

Fly-Pie has a D-Bus interface which allows not only to open configured menus via the command line, but also to open completely custom-made menus defined with a JSON string.

To see all available methods and signals you can introspect the interface:

```bash
gdbus introspect --session --dest org.gnome.Shell \
                 --object-path /org/gnome/shell/extensions/flypie
```

## Opening Menus Configured with the Menu Editor

Use the following command to open a menu you configured with the Fly-Pie's Menu Editor.
You just have to replace the only parameter `My Menu` with the name of your desired menu!

```bash
gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/shell/extensions/flypie \
           --method org.gnome.Shell.Extensions.flypie.ShowMenu 'My Menu'
```

There is also a similar method called `PreviewMenu` which will open the given menu in preview mode.

```bash
gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/shell/extensions/flypie \
           --method org.gnome.Shell.Extensions.flypie.PreviewMenu 'My Menu'
```

## Opening Custom Menus via JSON

You can pass a JSON menu configuration to the `ShowCustomMenu` to show a custom menu.
Here is an example showing a menu with two elements.
Selecting them will change your workspace up or down (by simulating a <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>Up</kbd> or a <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>Down</kbd> respectively).
Further below you will find a complete description of this JSON menu configuration format.

```bash
gdbus call --session --dest org.gnome.Shell                 \
  --object-path /org/gnome/shell/extensions/flypie          \
  --method org.gnome.Shell.Extensions.flypie.ShowCustomMenu \
  '{                                                        \
    "icon": "💠️",                                           \
    "children": [                                           \
      {                                                     \
        "name": "Up",                                       \
        "icon": "🔼️",                                       \
        "type": "Shortcut",                                 \
        "data": "<Primary><Alt>Up"                          \
      },                                                    \
      {                                                     \
        "name": "Down",                                     \
        "icon": "🔽️",                                       \
        "type": "Shortcut",                                 \
        "data": "<Primary><Alt>Down"                        \
      }                                                     \
    ]                                                       \
  }'
```

### The Menu Configuration Format 

**:information_source: _Pro-Tip:_** _You can export your menu configuration from the menu editor of Fly-Pie's settings dialog. The exported JSON file contains an array of menu configurations which follow the specification below. This way you can use the menu editor to design a menu which you want to open dynamically over the D-Bus!_

Each item in the menu hierarchy can have the following properties.
All of them are optional, the default values are noted in the description,
Some of them are only available for top-level menu items; this is noted in the table as well.

| Parameters | Value Type | Description |
|------------|------------|-------------|
| **`name`** | A string.  |  This will be shown in the center when the item is hovered. If omitted, it will be set based on the given `type`. |
| **`icon`** | An absolute image file path, an icon name or arbitrary text. | Icon names like `firefox` are commonly used. As text is an option too, you can use emoji like 🚀 for the icons! If omitted, it will be set based on the given `type`. |
| **`type`** | A string from the table below. | Some types require setting the additional `data` property. For items with children this defaults to `"CustomMenu"`, for leaf items this defaults to `"DBusSignal"`. |
| **`data`** | Additional data required for the `type`. | See the table below for details. The default value depends on the given `type`. |
| **`angle`** | A number from 0 - 359. | This forces the item to be placed in a specific direction. However, there is a restriction on the fixed angles. Inside a menu level, the fixed angles must be monotonically increasing, that is each fixed angle must be larger than any previous fixed angle. |
| **`centered`** | A boolean only for top-level items. | When set to `true`, the menu will be shown in the middle of the screen, else it will be shown at the mouse pointer. If omitted, this defaults to _`false`_. |
| **`children`** | An array of child items. | This can only be set for the `"type": "CustomMenu"`. No `data` is required. |

The table below lists all possible item types. Some of the types require that the `data` property is set to some value.

| Actions | Default `data`  | Description |
|------------|-----------------------|-------------|
| **`"Command"`** | `""` | This action executes a command given in `data`. This is primarily used to open applications but may have plenty of other use cases as well. |
| **`"DBusSignal"`** | `""` | This action does nothing on its own. But you can listen on the D-Bus for its activation. This can be very useful in custom menus opened via the command line. The string given in `data` will be passed as `itemID` to the `OnSelect` signal. Below this table you will find an example! |
| **`"File"`** | `""` | This action will open a file given with an absolute path in `data` with your system\'s default application. |
| **`"InsertText"`** | `""` | This action copies the text given in `data` to the clipboard and then simulates a Ctrl+V. This can be useful if you realize that you often write the same things. |
| **`"Shortcut"`** | `""` | This action simulates a key combination when activated. For example, this can be used to switch virtual desktops, control multimedia playback or to undo / redo operations. `data` should be something like `"<Primary>space"`. |
| **`"Uri"`** | `""` | When this action is activated, the URI given in `data` is opened with the default application. For http URLs, this will be your web browser. However, it is also possible to open other URIs such as `"mailto:foo@bar.org"`. |
| **Menus** | | |
| **`"CustomMenu"`** | _not used_ | Use the `"children"` property to add as many actions or submenus as you want! |
| **`"Bookmarks"`** | _not used_ | This menu shows an item for the trash, your desktop and each bookmarked directory. |
| **`"Devices"`** | _not used_ | This menu shows an item for each mounted volume, like USB-Sticks. |
| **`"Favorites"`** | _not used_ | This menu shows the applications you have pinned to Gnome Shell's Dash. |
| **`"FrequentlyUsed"`** | `"7"` | This menu shows a list of frequently used applications. You should limit the maximum number of shown applications to a reasonable number given in `data`. |
| **`"MainMenu"`** | _not used_ | This menu shows all installed applications. Usually, this is very cluttered as many sections contain too many items to be used efficiently. You should rather setup your own menus! This menu is only available if the typelib for GMenu is installed on the system. Usually the package is called something like `gir1.2-gmenu-3.0`. |
| **`"RecentFiles"`** | `"7"` | This menu shows a list of recently used files. You should limit the maximum number of shown files to a reasonable number given in `data`. |
| **`"RunningApps"`** | _not used_ | This menu shows all currently running applications. This is similar to the Alt+Tab window selection. As the entries change position frequently, this is actually not very effective. |
| **`"System"`** | _not used_ | This menu shows an items for screen-lock, shutdown, settings, etc. |

### Return Value

The `ShowMenu` methods will return an integer.
This will be either negative (Fly-Pie failed to parse the provided description, see [DBusInterface.js](common/DBusInterface.js) for a list of error codes) or a positive menu ID which will be passed to the signals of the interface.

If an error occurred, there is a good chance that Fly-Pie logged an error message. To see them use this command in another terminal:

```bash
journalctl -f -o cat | grep -E 'flypie|'
```

### The `"DBusSignal"` Action

If you want to make menu items perform actions which are not available in Fly-Pie, you can use the `"DBusSignal"` item type and wait for their selection on the D-Bus.

There are two signals; `OnCancel` will be fired when the user aborts the selection in a menu, `OnSelect` is activated when the user makes a selection.
Both signals send the _menu ID_ which has been reported by the corresponding `ShowMenu` call, in addition, `OnSelect` sends the _item ID_ of the selected item.

The _item ID_ will usually be a path in the form of `"/1/0"`.
This example would mean that the first child of the second child of the root menu was selected (indices are zero-based).
In the simple menu example below, selecting `Apatosaurus` will yield `"/1/0"`.
If you assigned a `data` property to some of your `"type": "DBusSignal"` items, this will be returned instead of the path (like the `cat!!` in the example below).

**:information_source: _Hint:_** _Note that no `"type"` is given in the example because `"CustomMenu"` is the default value if an item contains children and `"DBusSignal"` is the default value for leaf items._

```bash
gdbus call --session --dest org.gnome.Shell                 \
  --object-path /org/gnome/shell/extensions/flypie          \
  --method org.gnome.Shell.Extensions.flypie.ShowCustomMenu \
  '{                                                        \
    "icon": "😷️",                                           \
    "children": [                                           \
      {                                                     \
        "name": "Rocket",                                   \
        "icon":"🚀"                                         \
      },                                                    \
      {                                                     \
        "name": "Doughnut",                                 \
        "icon":"🍩",                                        \
        "children": [                                       \
          {                                                 \
            "name": "Apatosaurus",                          \
            "icon":"🦕"                                     \
          },                                                \
          {                                                 \
            "name": "Cat",                                  \
            "icon":"🐈",                                    \
            "data": "cat!!"                                 \
          }                                                 \
        ]                                                   \
      }                                                     \
  ]}'
```

You can use the following command to monitor the emitted signals:

```bash
gdbus monitor --session --dest org.gnome.Shell \
              --object-path /org/gnome/shell/extensions/flypie
```

<p align="center"><img src ="pics/hr.svg" /></p>
<p align="center">
  <a href="first-steps.md">&#11013; First Steps</a>
  <img src="pics/nav-space.svg"/>
  <a href="../README.md">&#127968; Index</a>
  <img src="pics/nav-space.svg"/>
  <a href="contributing.md">Contributing Guidelines &#10145;</a>
</p>
