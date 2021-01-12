<p align="center">
  <img src ="pics/banner-01.jpg" />
</p>

# Creating New Action Types for Fly-Pie

There are two fundamental item types in Fly-Pie: _Actions_ and _Menus_.
Actions have an `activate()` method which is called when the user selects them; Menus can have child Actions or child Menus. 

If you want to create a new Action type for Fly-Pie, this guide is made for you!
As an example, we will create an Action which shows a notification with a user-defined message whenever it is selected.

First, create a file `src/common/actions/ExampleAction.js` with the following content.
You should read the code, most of it is explained with inline comments!

```javascript
//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

// This is required for localization support.
const _ = imports.gettext.domain('flypie').gettext;

// We have to import the Main module optionally. This is because this file is included
// from both sides: From prefs.js and from extension.js. When included from prefs.js, the
// Main module is not available. This is not a problem, as the preferences will not call
// the createItem() methods below; they are merely interested in the action's name, icon
// and description.
let Main = undefined;

try {
  Main = imports.ui.main;
} catch (error) {
  // Nothing to be done, we're in settings-mode.
}

// Some extension-local imports we will use further down.
const Me           = imports.misc.extensionUtils.getCurrentExtension();
const utils        = Me.imports.src.common.utils;
const ItemRegistry = Me.imports.src.common.ItemRegistry;

//////////////////////////////////////////////////////////////////////////////////////////
// This simple example action shows a desktop notification when selected. The text of   //
// the notification can be defined in the Menu Editor of Fly-Pie.                       //
//////////////////////////////////////////////////////////////////////////////////////////

// This should be always named 'action'.
var action = {

  // There are two fundamental item types in Fly-Pie: Actions and Menus. Actions have an
  // activate() method which is called when the user selects the item, Menus can have
  // child Actions or Menus. In this example we create an Action!
  class: ItemRegistry.ItemClass.ACTION,

  // This will be shown in the add-new-item-popover of the settings dialog.
  // It should be translatable.
  name: _('ExampleAction'),

  // This is also used in the add-new-item-popover.
  icon: 'accessories-clipboard',

  // Translators: Please keep this short.
  // This is the (short) description shown in the add-new-item-popover.
  subtitle: _('Foo.'),

  // This is the (long) description shown when an item of this type is selected.
  description: _('Bar bar bar bar.'),

  // Items of this type have an additional data property which can be set by the user. The
  // data value chosen by the user is passed to the createItem() method further below.
  data: {

    // The data type determines which widget is visible when an item of this type is
    // selected in the settings dialog.
    type: ItemRegistry.ItemDataType.TEXT,

    // This is shown on the left above the data widget in the settings dialog.
    name: _('Message'),

    // Translators: Please keep this short.
    // This is shown on the right above the data widget in the settings dialog.
    description: _('Shown when this is activated.'),

    // This is be used as data for newly created items.
    default: _('Hello World!'),
  },

  // This will be called whenever a menu is opened containing an item of this kind.
  // The data value chosen by the user will be passed to this function.
  createItem: (data) => {
    // This will be printed to the log when a menu is opened containing such an action.
    utils.debug('ExampleAction Created!');

    // The activate() function will be called when the user selects this action.
    return {
      activate: () => {
        Main.notify(_('ExampleAction Selected!'), data);
      }
    };
  }
};
```

Once this file is in place, you just need to add the new Action to the `src/common/ItemRegistry.js`.
To do this, add the following line to the other, similar-looking lines in `getItemTypes()`.

```javascript
ExampleAction: actions.ExampleAction.action,
```

Finally you can restart GNOME Shell with <kbd>Alt</kbd> + <kbd>F2</kbd>, <kbd>r</kbd> + <kbd>Enter</kbd> (or logout / login on Wayland).
If you now open Fly-Pie's Menu Editor, you can add and configure your new Action!

That's it.
Now you can start modifying the code!

<p align="center"><img src ="pics/hr.svg" /></p>

<p align="center">
  <img src="pics/nav-space.svg"/>
  <a href="translating.md"><img src ="pics/left-arrow.png"/> Translating Fly-Pie</a>
  <img src="pics/nav-space.svg"/>
  <a href="../README.md#getting-started"><img src ="pics/home.png"/> Index</a>
  <img src="pics/nav-space.svg"/>
  <a href="creating-menus.md">Creating New Menu Types <img src ="pics/right-arrow.png"/></a>
</p>
