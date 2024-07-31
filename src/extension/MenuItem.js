//////////////////////////////////////////////////////////////////////////////////////////
//                               ___            _     ___                               //
//                               |   |   \/    | ) |  |                                 //
//                           O-  |-  |   |  -  |   |  |-  -O                            //
//                               |   |_  |     |   |  |_                                //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

// SPDX-FileCopyrightText: Simon Schneegans <code@simonschneegans.de>
// SPDX-License-Identifier: MIT

'use strict';

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gdk from 'gi://Gdk';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import Pango from 'gi://Pango';
import PangoCairo from 'gi://PangoCairo';
import GdkPixbuf from 'gi://GdkPixbuf';
import Cairo from 'gi://cairo';
import St from 'gi://St';

import * as utils from '../common/utils.js';

//////////////////////////////////////////////////////////////////////////////////////////
// Then MenuItem is a Clutter.Actor representing one node in the menu tree hierarchy.   //
// Based on a given MenuItemState, it is drawn differently. It is composed of several   //
// sub-actors, as shown in the diagram below:                                           //
//                                                                                      //
//   .----------.   .--------------------.   This displays the name of the currently    //
//   | MenuItem |---| _name              |   hovered child item. It is re-drawn         //
//   '----------'   '--------------------'   whenever the hovered item changes.         //
//         |                                                                            //
//         |        .--------------------.   This contains up to six actors, one for    //
//         |--------| _iconContainer     |   each of the CENTER, CHILD or GRANDCHILD    //
//         |        '--------------------'   with their _HOVERED variants. Usually,     //
//         |                                 only one of them is visible at a time.     //
//         |                                                                            //
//         |        .--------------------.   This contains a MenuItem for each child    //
//         |--------| _childrenContainer |   in the menu tree hierarchy. Based on the   //
//         |        '--------------------'   drawChildrenAbove-settings, this could     //
//         |                                 also be above the _iconContainer.          //
//         |                                                                            //
//         |        .--------------------.   This represents the connection line to the //
//         '--------| _traceContainer    |   active child. It is lazily allocated when  //
//                  '--------------------'   the state changes to PARENT.               //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

// This could be a static member of the class below, but this seems to be not supported
// yet.
export var MenuItemState = {
  // This is the default state. It is also used for children of grandchildren - those are
  // not shown at all.
  INVISIBLE: 0,

  // This is the state of a MenuItem which is currently active but without the pointer
  // hoovering it. That means that one of its children is currently hovered.
  CENTER: 1,

  // Same as above, but without any hovered child. That means, the pointer is currently in
  // the center of the menu.
  CENTER_HOVERED: 2,

  // This is used for direct inactive children of the center element.
  CHILD: 3,

  // This is used for the currently active (hovered) direct child item of the center.
  CHILD_HOVERED: 4,

  // When the mouse gets pressed above a child, it gets this state. They are drawn in a
  // similar fashion as hovered children but do not automatically update their position.
  CHILD_DRAGGED: 5,

  // This is used for the children of the children of the center.
  GRANDCHILD: 6,

  // This is used for the children of the currently hovered child of the center.
  GRANDCHILD_HOVERED: 7,

  // This is used for the back-link children. In the menu hierarchy they are the parents
  // but they are drawn in a similar fashion as normal children.
  PARENT: 8,

  // Same as above, but currently hovered.
  PARENT_HOVERED: 9,
};

// This stores the elements of Fly-Pie's Gio.Settings which are relevant for drawing menu
// items. This improves performance as we do not always have to retrieve the values over
// the D-Bus.
let MenuItemSettings = {};

// clang-format off
export var MenuItem = GObject.registerClass({
  Properties: {
    'angle': GObject.ParamSpec.double(
      'angle', 'angle', 'The angle of the MenuItem in degrees.',
      GObject.ParamFlags.READWRITE, 0, 360, 0),
    'icon': GObject.ParamSpec.string(
      'icon', 'icon', 'The icon to be used by this menu item. ' +
      'Can be an "icon-name", an emoji like "🚀" or a path like "../icon.png".',
      GObject.ParamFlags.READWRITE, 'image-missing'),
    'show-label': GObject.ParamSpec.boolean(
      'show-label', 'show-label', 'Wether the item should draw its name.',
      GObject.ParamFlags.READWRITE, false),
    'id': GObject.ParamSpec.string(
      'id', 'id', 'The ID of the menu item. ',
      GObject.ParamFlags.READWRITE, 'image-missing')
  },
  Signals: {}
},
class MenuItem extends Clutter.Actor {
  // clang-format on

  // ------------------------------------------------------------ constructor / destructor

  _init(params = {}) {
    super._init(params);

    // The state this MenuItem currently is in. This can be changed with setState(). To
    // reflect the new state, a redraw() will be required.
    this._state = MenuItemState.INVISIBLE;

    // This will be set to false upon the first call to redraw(). It is used to initialize
    // the MenuItem's appearance without animations.
    this._firstRedraw = true;

    // This is set to true when the icons were deleted due to the user modifying the
    // appearance settings in preview mode. If it is true, the icons will be re-created
    // with full opacity as they are obviously already visible. Else there would be heavy
    // preview-flickering when changing settings.
    this._forcedRecreation = false;

    // This is recursively updated using setParentColor(). It is used for the background
    // coloring when the color mode is set to 'parent'.
    this._parentColor = utils.createColorRGB( 255, 255, 255);

    // This callback will be executed when the item is selected. Only items without any
    // children but with such a callback can be activated.
    this._selectionCallback = null;

    // This callback will be executed when the item is hovered. This will only be called
    // for actions, that is items without any children.
    this._hoverCallback   = null;
    this._unhoverCallback = null;

    // Create Children Container. This eventually will contain one MenuItem for each child
    // item of this menu.
    this._childrenContainer = new Clutter.Actor();
    this.add_child(this._childrenContainer);

    // This will contain the currently hovered / dragged child item.
    this._activeChildIndex = -1;

    // Create the Icon Container. This eventually will contain one actor for each visible
    // MenuItemState, except for the PARENT* states, as they are drawn like CHILDREN*. We
    // create one icon for each state as they most likely have different resolutions and
    // background colors. They are created lazily and usually only one of them is visible
    // at a time (based on the current MenuItemState). We use a Clutter.BinLayout to
    // position them exactly on top of each other to allow for smooth transitions.
    this._iconContainer = new Clutter.Actor();
    this._iconContainer.set_layout_manager(new Clutter.BinLayout());
    this.add_child(this._iconContainer);

    // This will contain an actor displaying the name of the respective item. Once a child
    // is hovered the opacity of the corresponding name will be set to 255, the opacity of
    // names of all siblings will be set to zero. For some reason, the Clutter.Text is not
    // shown when we use the normal constructor. So we use "new_with_text", the font is
    // however overridden in _onSettingsChange.
    this._name = Clutter.Text.new_with_text('Sans', 'foo');
    this._name.set_line_wrap(true);
    this._name.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
    this._name.set_ellipsize(Pango.EllipsizeMode.END);
    this._name.set_line_alignment(Pango.Alignment.CENTER);
    this._name.set_opacity(0);
    this.add_child(this._name);
  }

  get icon() {
    if (this._icon === undefined) {
      this._icon = null;
    }

    return this._icon;
  }

  set icon(value) {
    if (this.icon !== value) {
      this._icon = value;
      this.notify('icon');
      this._forceIconRecreation();
    }
  }

  // -------------------------------------------------------------------- public interface

  // This is called by the Menu to add child MenuItems to this MenuItem.
  addMenuItem(menuItem) {
    this._childrenContainer.add_child(menuItem);
  }

  // This is called by the Menu to remove child MenuItems from this MenuItem.
  removeMenuItem(menuItem) {
    this._childrenContainer.remove_child(menuItem);
  }

  // Returns an array of child menu items of this.
  getChildMenuItems() {
    return this._childrenContainer.get_children();
  }

  // Sets menuItem to be the index'th child of this.
  setChildMenuItemIndex(menuItem, index) {
    return this._childrenContainer.set_child_at_index(menuItem, index);
  }

  // This contains the currently hovered / dragged child item.
  getActiveChildIndex() {
    return this._activeChildIndex;
  }

  // This callback will be executed when the item is selected. Only items without any
  // children but with an selection callback can be activated. Can be set to null to
  // disable the activate-ability.
  setSelectionCallback(func) {
    this._selectionCallback = func;
  }

  // Returns the selection callback set above.
  getSelectionCallback() {
    return this._selectionCallback;
  }

  // This callback will be executed when the item is hovered. This will only be called
  // for actions, that is for items without any children.
  setHoverCallback(func) {
    this._hoverCallback = func;
  }

  // Returns the hover callback set above.
  getHoverCallback() {
    return this._hoverCallback;
  }

  // This callback will be executed when the item stops being hovered. This will only be
  // called for actions, that is for items without any children.
  setUnhoverCallback(func) {
    this._unhoverCallback = func;
  }

  // Returns the hover callback set above.
  getUnhoverCallback() {
    return this._unhoverCallback;
  }

  // This is called during redraw() of the parent MenuItem. redraw() traverses the menu
  // tree top-to-bottom, so this will be called before the redraw() of this.
  setParentColor(color) {
    this._parentColor = color;
  }

  // This is called for each item in the current menu selection chain. That is for each
  // item which is either CENTER, CENTER_HOVERED, PARENT, or PARENT_HOVERED. It will call
  // itself recursively for the entire menu tree below the active item, updating each
  // child's state accordingly. An exception are the PARENT and PARENT_HOVERED states,
  // here only the inactive children are set to GRANDCHILD and GRANDCHILD_HOVERED
  // respectively. It's not called for the active child, as it's the responsibility to set
  // the state of the active child in this case.
  // The activeChildIndex can be omitted to indicate that it did not change.
  setState(state, activeChildIndex) {

    // Store the state and the active child's index as members. They will be used during
    // the next call to redraw().
    this._state = state;

    if (activeChildIndex != undefined) {
      this._activeChildIndex = activeChildIndex;
    }

    // Now call setState() recursively on all children.
    this._childrenContainer.get_children().forEach((child, index) => {
      switch (state) {

        // If the center item is hovered, no child is hovered.
        case MenuItemState.CENTER_HOVERED:
          child.setState(MenuItemState.CHILD, -1);
          break;

        // If the center item is not hovered, the child with the given index is hovered.
        case MenuItemState.CENTER:
          if (index == this._activeChildIndex) {
            child.setState(MenuItemState.CHILD_HOVERED, -1);
          } else {
            child.setState(MenuItemState.CHILD, -1);
          }
          break;

        // All children of children become grandchildren.
        case MenuItemState.CHILD:
          child.setState(MenuItemState.GRANDCHILD, -1);
          break;

        // All children of hovered children become hovered grandchildren.
        case MenuItemState.CHILD_HOVERED:
        case MenuItemState.CHILD_DRAGGED:
          child.setState(MenuItemState.GRANDCHILD_HOVERED, -1);
          break;

        // Children of parents are drawn like grandchildren.
        case MenuItemState.PARENT:
          if (index != this._activeChildIndex) {
            child.setState(MenuItemState.GRANDCHILD, -1);
          }
          break;

        // Children of hovered parents are drawn like hovered grandchildren.
        case MenuItemState.PARENT_HOVERED:
          if (index != this._activeChildIndex) {
            child.setState(MenuItemState.GRANDCHILD_HOVERED, -1);
          }
          break;

        // Children of invisible items are invisible as well.
        default:
          child.setState(MenuItemState.INVISIBLE, -1);
      }
    });
  }

  // Returns the current MenuItemState.
  getState() {
    return this._state;
  }

  // This first updates the MenuItemSettings global variable and then calls
  // this._onSettingsChange which will proceed recursively.
  onSettingsChange(settings) {

    // Then parse all settings required during the next call to redraw().
    const globalScale = settings.get_double('global-scale') * utils.getHDPIScale();

    // clang-format off
    MenuItemSettings = {
      globalScale:             globalScale,
      easingDuration:          settings.get_double('easing-duration') * 1000,
      easingMode:              settings.get_enum('easing-mode'),
      textColor:               utils.parseColor(settings.get_string('text-color'))[1],
      font:                    settings.get_string('font'),
      labelFont:               settings.get_string('label-font'),
      traceThickness:          settings.get_double('trace-thickness') * globalScale,
      traceColor:              utils.parseColor(settings.get_string('trace-color'))[1],
      state: new Map ([
        [MenuItemState.INVISIBLE, {
          colorMode:           '',
          size:                0,
          offset:              0,
          iconOpacity:         0,
        }],
        [MenuItemState.CENTER, {
          colorMode:           settings.get_string('center-color-mode'),
          fixedColor:          utils.parseColor(settings.get_string('center-fixed-color'))[1],
          size:                settings.get_double('center-size') * globalScale,
          offset:              0,
          iconScale:           settings.get_double('center-icon-scale'),
          iconCrop:            settings.get_double('center-icon-crop'),
          iconOpacity:         settings.get_double('center-icon-opacity'),
          autoColorSaturation: settings.get_double('center-auto-color-saturation'),
          autoColorLuminance:  settings.get_double('center-auto-color-luminance'),
          autoColorOpacity:    settings.get_double('center-auto-color-opacity') * 255,
          backgroundImage:     MenuItem.loadBackgroundImage(settings.get_string('center-background-image'),
                                                            settings.get_double('center-size') * globalScale),
          drawChildrenAbove:   settings.get_boolean('child-draw-above'),
        }],
        [MenuItemState.CENTER_HOVERED, {
          colorMode:           settings.get_string('center-color-mode-hover'),
          fixedColor:          utils.parseColor(settings.get_string('center-fixed-color-hover'))[1],
          size:                settings.get_double('center-size-hover') * globalScale,
          offset:              0,
          iconScale:           settings.get_double('center-icon-scale-hover'),
          iconCrop:            settings.get_double('center-icon-crop-hover'),
          iconOpacity:         settings.get_double('center-icon-opacity-hover'),
          autoColorSaturation: settings.get_double('center-auto-color-saturation-hover'),
          autoColorLuminance:  settings.get_double('center-auto-color-luminance-hover'),
          autoColorOpacity:    settings.get_double('center-auto-color-opacity-hover') * 255,
          backgroundImage:     MenuItem.loadBackgroundImage(settings.get_string('center-background-image-hover'),
                                                            settings.get_double('center-size-hover') * globalScale),
          drawChildrenAbove:   settings.get_boolean('child-draw-above'),
        }],
        [MenuItemState.CHILD, {
          colorMode:           settings.get_string('child-color-mode'),
          fixedColor:          utils.parseColor(settings.get_string('child-fixed-color'))[1],
          size:                settings.get_double('child-size')     * globalScale,
          offset:              settings.get_double('child-offset')   * globalScale,
          iconScale:           settings.get_double('child-icon-scale'),
          iconCrop:            settings.get_double('child-icon-crop'),
          iconOpacity:         settings.get_double('child-icon-opacity'),
          autoColorSaturation: settings.get_double('child-auto-color-saturation'),
          autoColorLuminance:  settings.get_double('child-auto-color-luminance'),
          autoColorOpacity:    settings.get_double('child-auto-color-opacity')  * 255,
          backgroundImage:     MenuItem.loadBackgroundImage(settings.get_string('child-background-image'),
                                                            settings.get_double('child-size') * globalScale),
          drawChildrenAbove:   settings.get_boolean('grandchild-draw-above'),
        }],
        [MenuItemState.CHILD_HOVERED, {
          colorMode:           settings.get_string('child-color-mode-hover'),
          fixedColor:          utils.parseColor(settings.get_string('child-fixed-color-hover'))[1],
          size:                settings.get_double('child-size-hover')    * globalScale,
          offset:              settings.get_double('child-offset-hover')  * globalScale,
          iconScale:           settings.get_double('child-icon-scale-hover'),
          iconCrop:            settings.get_double('child-icon-crop-hover'),
          iconOpacity:         settings.get_double('child-icon-opacity-hover'),
          autoColorSaturation: settings.get_double('child-auto-color-saturation-hover'),
          autoColorLuminance:  settings.get_double('child-auto-color-luminance-hover'),
          autoColorOpacity:    settings.get_double('child-auto-color-opacity-hover') * 255,
          backgroundImage:     MenuItem.loadBackgroundImage(settings.get_string('child-background-image-hover'),
                                                            settings.get_double('child-size-hover') * globalScale),
          drawChildrenAbove:   settings.get_boolean('grandchild-draw-above'),
        }],
        [MenuItemState.GRANDCHILD, {
          colorMode:           settings.get_string('grandchild-color-mode'),
          fixedColor:          utils.parseColor(settings.get_string('grandchild-fixed-color'))[1],
          size:                settings.get_double('grandchild-size')    * globalScale,
          offset:              settings.get_double('grandchild-offset')  * globalScale,
          iconOpacity:         0,
          backgroundImage:     MenuItem.loadBackgroundImage(settings.get_string('grandchild-background-image'),
                                                            settings.get_double('grandchild-size') * globalScale),
          drawAbove:           settings.get_boolean('grandchild-draw-above'),
        }],
        [MenuItemState.GRANDCHILD_HOVERED, {
          colorMode:           settings.get_string('grandchild-color-mode-hover'),
          fixedColor:          utils.parseColor(settings.get_string('grandchild-fixed-color-hover'))[1],
          size:                settings.get_double('grandchild-size-hover')   * globalScale,
          offset:              settings.get_double('grandchild-offset-hover') * globalScale,
          iconOpacity:         0,
          backgroundImage:     MenuItem.loadBackgroundImage(settings.get_string('grandchild-background-image-hover'),
                                                            settings.get_double('grandchild-size-hover') * globalScale),
          drawAbove:           settings.get_boolean('grandchild-draw-above'),
        }]
      ]),
    };
    // clang-format on

    this._onSettingsChange();
  }

  // This updates all parameters (such as position, opacity or colors) of the individual
  // actors of this MenuItem. It is usually called after the setState() above. It
  // automatically calls redraw() on all child MenuItems of this.
  redraw() {

    // PARENT items and PARENT_HOVERED items are drawn like CHILD and CHILD_HOVERED items
    // respectively; *_DRAGGED items are drawn like CHILD_HOVERED items. Therefore we
    // create a variable for the "visual state" which is the same as the _state in all
    // other cases.
    let visualState = this._state;

    if (this._state == MenuItemState.PARENT) {
      visualState = MenuItemState.CHILD;
    } else if (
        this._state == MenuItemState.CHILD_DRAGGED ||
        this._state == MenuItemState.PARENT_HOVERED) {
      visualState = MenuItemState.CHILD_HOVERED;
    }

    // Hide the item completely if invisible.
    this.visible = visualState != MenuItemState.INVISIBLE;

    // The _settings member contains a Map of settings for each MenuItemState.
    const settings = MenuItemSettings.state.get(visualState);

    // Depending on the corresponding settings key, raise or lower the child MenuItems
    // of this above or below the background.
    if (visualState != MenuItemState.INVISIBLE) {
      if (settings.drawChildrenAbove) {
        this.set_child_above_sibling(this._childrenContainer, this._iconContainer);
      } else {
        this.set_child_below_sibling(this._childrenContainer, this._iconContainer);
      }
    }

    // If our state is MenuItemState.CENTER, redraw the name text. Else hide the
    // name by setting its opacity to zero.
    if (visualState == MenuItemState.CENTER && this._activeChildIndex >= 0) {
      const child = this._childrenContainer.get_children()[this._activeChildIndex];
      this._name.set_text(child.name);
      this._name.set_easing_duration(0);
      const nameHeight = this._name.get_layout().get_pixel_extents()[1].height /
          utils.getHDPIResourceScale();
      this._name.set_translation(
          Math.floor(-this._name.width / 2), Math.floor(-nameHeight / 2), 0);
      this._name.set_easing_duration(MenuItemSettings.easingDuration);

      this._name.opacity = 255;
    } else {
      this._name.opacity = 0;
    }

    // This easing duration and mode are used for size and position transitions further
    // below. We set the easing duration to zero for the initial call to redraw() in
    // order to avoid animations when the menu shows up.
    let easingDuration = this._firstRedraw ? 0 : MenuItemSettings.easingDuration;
    this._firstRedraw  = false;

    this.set_easing_duration(easingDuration);
    this.set_easing_mode(MenuItemSettings.easingMode);

    // If our state is some child or grandchild state, set the translation based on the
    // angle and the specified offset. For all other states, the translation is set from
    // the Menu.
    if (this._state == MenuItemState.CHILD ||
        this._state == MenuItemState.CHILD_HOVERED ||
        this._state == MenuItemState.GRANDCHILD ||
        this._state == MenuItemState.GRANDCHILD_HOVERED ||
        this._state == MenuItemState.INVISIBLE) {

      const angle = this.angle * Math.PI / 180;
      this.set_translation(
          Math.floor(Math.sin(angle) * settings.offset),
          -Math.floor(Math.cos(angle) * settings.offset), 0);
    }

    // No we compute the background color for the currently visible icon. This will be
    // propagated as parent color to all children.
    let backgroundColor = settings.fixedColor;

    // If the color mode is 'auto', we calculate an average color of the icon.
    if (settings.colorMode == 'auto') {

      // This won't change, so we need to compute it only once.
      if (this._averageIconColor == undefined) {

        // We store the average color as a property of this.
        const surface          = utils.createIcon(this.icon, 24, MenuItemSettings.font, {
          red: MenuItemSettings.textColor.red / 255,
          green: MenuItemSettings.textColor.green / 255,
          blue: MenuItemSettings.textColor.blue / 255
                 });
        const [r, g, b]        = utils.getAverageIconColor(surface, 24);
        this._averageIconColor = utils.createColorRGB(r, g, b);
      }

      // Now we modify this color based on the configured luminance and saturation values.
      backgroundColor = MenuItem.getAutoColor(
          this._averageIconColor, settings.autoColorLuminance,
          settings.autoColorSaturation, settings.autoColorOpacity);

    } else if (settings.colorMode == 'parent') {
      backgroundColor = this._parentColor;
    }

    // If we are in some center- or child- or grandchild-state and have no icon for this
    // state yet, create a new icon! This will also happen after a settings change, as
    // icons are deleted to force a re-creation here.
    if ((visualState == MenuItemState.CENTER ||
         visualState == MenuItemState.CENTER_HOVERED ||
         visualState == MenuItemState.CHILD ||
         visualState == MenuItemState.CHILD_HOVERED ||
         visualState == MenuItemState.GRANDCHILD ||
         visualState == MenuItemState.GRANDCHILD_HOVERED) &&
        this._iconContainer[visualState] == undefined) {

      let icon;
      if (visualState == MenuItemState.CENTER ||
          visualState == MenuItemState.CENTER_HOVERED ||
          visualState == MenuItemState.CHILD ||
          visualState == MenuItemState.CHILD_HOVERED) {

        let label;
        let labelScale = MenuItemSettings.globalScale;

        if (this.showLabel &&
            (visualState == MenuItemState.CHILD ||
             visualState == MenuItemState.CHILD_HOVERED)) {

          label = this.name;

          if (visualState == MenuItemState.CHILD_HOVERED) {
            const normalSettings = MenuItemSettings.state.get(MenuItemState.CHILD);
            labelScale *= settings.size / normalSettings.size;
          }
        }

        icon = MenuItem.createIcon(
            backgroundColor, settings.backgroundImage, settings.size, this.icon,
            settings.iconScale, settings.iconCrop, settings.iconOpacity, label,
            labelScale, MenuItemSettings.textColor, MenuItemSettings.font,
            MenuItemSettings.labelFont);

      } else {
        // Grandchildren have only a circle as icon. Therefore no icon name is passed to
        // this method.
        icon =
            MenuItem.createIcon(backgroundColor, settings.backgroundImage, settings.size);
      }

      this._iconContainer[visualState] = icon;
      this._iconContainer.add_child(icon);

      // When the settings are modified (especially when a menu is shown
      // in preview mode), the icons are completely reloaded. To make this jitter-free,
      // the _forcedRecreation tells us whether we have to load the icon at full opacity.
      icon.set_opacity(this._forcedRecreation ? 255 : 0);
      this._forcedRecreation = false;
    }

    // Now we update the opacity of the individual icons. Only one icon - the one for the
    // current state - should be visible. There is however, a transition phase were
    // multiple might be visible at the same time.
    const updateOpacity = (state) => {
      const icon = this._iconContainer[state];
      if (icon != undefined) {

        // Set opacity to 255 only for the current state.
        const opacity = visualState == state ? 255 : 0;

        // Use different easing modes when fading out or fading in. If we would use a
        // linear transition, the opacity of two cross-fading icons would not add up to
        // 255. If done like this, it's not correct either but looks very good.
        icon.set_easing_mode(
            icon.opacity > opacity ? Clutter.AnimationMode.EASE_IN_QUAD :
                                     Clutter.AnimationMode.EASE_OUT_QUAD);
        icon.set_easing_duration(easingDuration);
        icon.set_opacity(opacity);
      }
    };

    updateOpacity(MenuItemState.CENTER);
    updateOpacity(MenuItemState.CENTER_HOVERED);
    updateOpacity(MenuItemState.CHILD);
    updateOpacity(MenuItemState.CHILD_HOVERED);
    updateOpacity(MenuItemState.GRANDCHILD);
    updateOpacity(MenuItemState.GRANDCHILD_HOVERED);

    // Now we update the trace line to the active child if we are in a parent state.
    if (this._state == MenuItemState.PARENT ||
        this._state == MenuItemState.PARENT_HOVERED) {

      // Get the position of the currently active child.
      const child = this._childrenContainer.get_children()[this._activeChildIndex];
      let x       = child.translation_x;
      let y       = child.translation_y;

      // There might be a transition in progress, so we rather grab the final values of
      // them.
      const tx = child.get_transition('translation-x');
      const ty = child.get_transition('translation-y');
      if (tx) x = tx.interval.final;
      if (ty) y = ty.interval.final;

      // In most cases we can use a transition to rotate the trace. However, when the
      // active child is currently being dragged around or the trace is currently
      // invisible, we should use no transition.
      let rotationEasingDuration = MenuItemSettings.easingDuration;
      if (child.getState() == MenuItemState.CHILD_DRAGGED || this._trace == undefined ||
          this._trace.opacity == 0) {

        rotationEasingDuration = 0;
      }

      // The length of the trace should always be transitioned.
      const lengthEasingDuration = MenuItemSettings.easingDuration;

      // Finally update the trace actor.
      this.drawTrace(x, y, rotationEasingDuration, lengthEasingDuration);

    } else {

      // We are no parent (anymore) so we should hide the trace.
      this.hideTrace();
    }

    // Finally call redraw() recursively on all children.
    if (visualState != MenuItemState.INVISIBLE) {
      this._childrenContainer.get_children().forEach(child => {
        child.setParentColor(backgroundColor);
        child.redraw();
      });
    }
  }

  // While implementing this trace segment visualization I ran into several Clutter
  // issues. Therefore the code below is more complicated than it should be.
  // The most annoying was that button release events are somehow not fired when during
  // a shortly preceding motion event the width of the _trace was changed (or any other
  // allocation-changing property as it seems). To circumvent this, I used a container
  // actor which is used for rotating the actor only. The width of the _trace is then
  // adjusted by scaling it along the x-axis.
  drawTrace(x, y, rotationEasingDuration, lengthEasingDuration) {

    // We need to create the _trace actor if it's not there yet.
    if (this._trace == undefined) {
      this._traceContainer = new Clutter.Actor();
      this._trace          = new St.DrawingArea({width: 1});
      this._trace.connect('repaint', (canvas) => {
        const ctx             = canvas.get_context();
        const [width, height] = canvas.get_surface_size();

        ctx.setOperator(Cairo.Operator.CLEAR);
        ctx.paint();
        ctx.setOperator(Cairo.Operator.OVER);

        // Simply draw a line in the middle of the canvas from left to right.
        ctx.setSourceRGBA(
            MenuItemSettings.traceColor.red / 255,
            MenuItemSettings.traceColor.green / 255,
            MenuItemSettings.traceColor.blue / 255,
            MenuItemSettings.traceColor.alpha / 255);
        ctx.setLineWidth(MenuItemSettings.traceThickness);
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();

        // Explicitly tell Cairo to free the context memory. Is this really necessary?
        ctx.$dispose();
      });

      this.insert_child_below(this._traceContainer, null);
      this._traceContainer.add_child(this._trace);
    }

    // First we update the trace's thickness (if the settings changed). We add on pixel
    // padding on each side to get smooth antialiasing.
    if (this._trace.get_height() != MenuItemSettings.traceThickness + 2) {
      this._trace.set_height(MenuItemSettings.traceThickness + 2);
      this._trace.set_translation(0, -this._trace.get_height() / 2, 0);
    }

    // Fade-in the trace it it's currently invisible.
    this._trace.set_easing_duration(MenuItemSettings.easingDuration);
    this._trace.set_easing_mode(Clutter.AnimationMode.LINEAR);
    this._trace.set_opacity(255);
    this._trace.set_easing_duration(lengthEasingDuration);
    this._trace.set_easing_mode(MenuItemSettings.easingMode);

    // Now set the width to the child's distance.
    this._trace.set_scale(Math.sqrt(x * x + y * y), 1);

    // Then update the direction.
    let targetAngle = Math.atan2(y, x) * 180 / Math.PI;
    if (targetAngle - this._traceContainer.rotation_angle_z > 180) {
      targetAngle -= 360;
    }
    if (targetAngle - this._traceContainer.rotation_angle_z < -180) {
      targetAngle += 360;
    }

    this._traceContainer.set_easing_mode(MenuItemSettings.easingMode);
    this._traceContainer.set_easing_duration(rotationEasingDuration);
    this._traceContainer.set_rotation_angle(Clutter.RotateAxis.Z_AXIS, targetAngle);
  }

  // This makes the trace (if there is one) invisible so that we can use it later again.
  hideTrace() {
    if (this._trace != undefined) {
      this._trace.set_easing_duration(MenuItemSettings.easingDuration);
      this._trace.set_easing_mode(Clutter.AnimationMode.LINEAR);
      this._trace.set_opacity(0);
      this._trace.set_easing_mode(MenuItemSettings.easingMode);
      this._trace.set_scale(1, 1);
    }
  }

  // ------------------------------------------------------------------------ static stuff

  // If the items automatically define their background color, we have to adjust the
  // luminance and saturation according to the settings. This method takes a Clutter.Color
  // and returns a new Clutter.Color. The output color has the same hue as the input color
  // but the luminance and saturation values are based on the given input values.
  static getAutoColor(averageColor, luminance, saturation, opacity) {

    let h, l, s;
    if (utils.shellVersionIsAtLeast(47, 'alpha')) {
      [h,s,l] = averageColor.to_hsl();
    } else {
      [h, l, s] = averageColor.to_hls();
    }

    // First we increase the base luminance to 0.5 so that we do not create pitch black
    // colors.
    l = 0.5 + l * 0.5;

    // Tweak the luminance based on the settings values.
    const lFac = luminance * 2 - 1;
    l          = lFac > 0 ? l * (1 - lFac) + 1 * lFac : l * (lFac + 1);

    // We only modify the saturation if it's not too low. Else we will get artificial
    // colors for already quite desaturated icons.
    if (s > 0.1) {
      const sFac = saturation * 2 - 1;
      s          = sFac > 0 ? s * (1 - sFac) + 1 * sFac : s * (sFac + 1);
    }

    const result = utils.createColorHSL(h, l, s);
    result.alpha = opacity;

    return result;
  }

  // Static helper to load the background image of a menu item. If "file" exists, a pixbuf
  // with the given size will be returned. If high-dpi scaling is enabled, the returned
  // image can be actually larger.
  static loadBackgroundImage(file, size) {

    // Apply high-dpi resource scaling.
    size *= utils.getHDPIResourceScale();

    // If the path is a relative path, it may be a child of the preset directory.
    if (file != '' && !GLib.path_is_absolute(file)) {
      file = utils.getPath() + 'presets/' + file;
    }

    // Only attempt to load an image if the background image property is set and exists.
    if (file != '' && Gio.File.new_for_path(file).query_exists(null)) {
      try {
        return GdkPixbuf.Pixbuf.new_from_file_at_scale(file, size, size, false);
      } catch (error) {
        utils.debug('Failed to load background image: ' + error);
      }
    }

    return null;
  }

  // This creates a Clutter.Actor containing an image of this MenuItem's icon. It's static
  // so that others can use this to create similar icons (for example the touch buttons).
  static createIcon(
      backgroundColor, backgroundImage, backgroundSize, iconName, iconScale, iconCrop,
      iconOpacity, label, labelScale, textColor, font, labelFont) {

    const actor = new St.DrawingArea({
      height: backgroundSize,
      width: backgroundSize,
    });

    actor.connect('repaint', (canvas) => {
      const ctx = canvas.get_context();

      // Clear any previous content.
      ctx.setOperator(Cairo.Operator.CLEAR);
      ctx.paint();
      ctx.setOperator(Cairo.Operator.OVER);

      ctx.save();

      // If a background image is given, we use it. Else we will draw a simple colored
      // circle.
      if (backgroundImage != null) {

        // Apply high-dpi scaling.
        const resourceScale = utils.getHDPIResourceScale();
        ctx.scale(1 / resourceScale, 1 / resourceScale);

        // TODO: As Cairo.Operator.MULTIPLY uses normal OVER-alpha-blending, the code
        // below does not really multiply the backgroundImage with the given color. Black
        // semi-transparent areas will actually become tinted grays! This could be solved
        // if the alpha channel would be multiplied as well, but this is difficult to
        // implement as Cairo uses premultiplied alpha. Doing this manually with a
        // for-loop through al pixels is too slow in gjs...
        // If anybody knows how to do a simple result.rgba = first.rgba * second.rgba in
        // Cairo, please let me know :)

        // We first draw the image in normal colors with Cairo.Operator.OVER.
        Gdk.cairo_set_source_pixbuf(ctx, backgroundImage, 0, 0);
        ctx.paint();

        // This is the backgroundImage above as a Cairo.Surface. This is used as a mask
        // further below.
        const pattern = ctx.getSource();

        // Then we use Cairo.Operator.MULTIPLY to colorize the image. We use ctx.mask()
        // in order to maintain the alpha channel of the original image.
        ctx.setSourceRGBA(
            backgroundColor.red / 255, backgroundColor.green / 255,
            backgroundColor.blue / 255, backgroundColor.alpha / 255);
        ctx.setOperator(Cairo.Operator.MULTIPLY);
        ctx.mask(pattern);

      } else {

        // Draw a circle!
        ctx.scale(backgroundSize, backgroundSize);
        ctx.translate(0.5, 0.5);
        ctx.arc(0, 0, 0.5, 0, 2.0 * Math.PI);
        ctx.setSourceRGBA(
            backgroundColor.red / 255, backgroundColor.green / 255,
            backgroundColor.blue / 255, backgroundColor.alpha / 255);
        ctx.fill();
      }

      ctx.restore();

      // Paint the icon!
      if (iconName != undefined) {

        // If a label is given, we draw the icon to an offscreen group in order to be able
        // to fade out the bottom area of the icon.
        if (label != undefined) {
          ctx.pushGroup();
          ctx.save();
        }

        const iconSize = backgroundSize * iconScale;

        // Clip the icon according to the given clip radius. Sqrt(2) is to ensure that the
        // entire icon is visible if iconCrop == 1 is given.
        const clipRadius = iconSize * iconCrop * Math.sqrt(2) / 2;
        ctx.arc(backgroundSize / 2, backgroundSize / 2, clipRadius, 0, 2.0 * Math.PI);
        ctx.clip();

        ctx.translate((backgroundSize - iconSize) / 2, (backgroundSize - iconSize) / 2);

        // Apply high-dpi scaling.
        const resourceScale = utils.getHDPIResourceScale();
        ctx.scale(1 / resourceScale, 1 / resourceScale);

        utils.paintIcon(ctx, iconName, iconSize * resourceScale, iconOpacity, font, {
          red: textColor.red / 255,
          green: textColor.green / 255,
          blue: textColor.blue / 255
        });

        // If a label is given, we fade out the bottom area of the icon an draw the label
        // there.
        if (label != undefined) {
          ctx.restore();

          // Size and position of the label are hard-coded for now.
          const labelWidth       = backgroundSize * 0.6;
          const verticalPosition = backgroundSize * 0.85;
          const gradientStart    = backgroundSize * 0.55;
          const gradientEnd      = backgroundSize * 0.75;

          // Fade out the bottom part of the icon with a gradient.
          const gradient = new Cairo.LinearGradient(0, gradientStart, 0, gradientEnd);
          gradient.addColorStopRGBA(0, 0, 0, 0, 0);
          gradient.addColorStopRGBA(1, 1, 1, 1, 1);
          ctx.setOperator(Cairo.Operator.DEST_OUT);
          ctx.setSource(gradient);
          ctx.paint();
          ctx.setOperator(Cairo.Operator.OVER);

          ctx.popGroupToSource();
          ctx.paint();

          // Setup the font to be used for the label.
          const fontDescription = Pango.FontDescription.from_string(labelFont);
          fontDescription.set_size(fontDescription.get_size() * labelScale);

          const layout = PangoCairo.create_layout(ctx);
          layout.set_font_description(fontDescription);
          layout.set_alignment(Pango.Alignment.CENTER);
          layout.set_ellipsize(Pango.EllipsizeMode.END);
          layout.set_width(Pango.units_from_double(labelWidth));
          layout.set_text(label, -1);

          // Draw the label at the bottom.
          const extents = layout.get_pixel_extents()[1];
          ctx.setSourceRGBA(
              textColor.red / 255, textColor.green / 255, textColor.blue / 255,
              iconOpacity);
          ctx.translate(
              Math.floor((backgroundSize - labelWidth) / 2),
              Math.floor(verticalPosition - extents.height));

          PangoCairo.update_layout(ctx, layout);
          PangoCairo.show_layout(ctx, layout);
        }
      }

      // Explicitly tell Cairo to free the context memory. Is this really necessary?
      // https://wiki.gnome.org/Projects/GnomeShell/Extensions/TipsOnMemoryManagement#Cairo
      ctx.$dispose();
    });

    return actor;
  }

  // ----------------------------------------------------------------------- private stuff

  // This is called once after construction and then whenever something in the appearance
  // settings has changed. This calls itself recursively on the entire menu tree below
  // this MenuItem.
  _onSettingsChange() {

    // First we reset the icon members to force their re-creation during the next state
    // change. As many settings affect the icon size or background color, we simply do
    // this in any case. This could be optimized by limiting this to the cases where
    // settings keys were changed which actually affect the icons.
    this._forceIconRecreation();

    // Most of the settings will come into effect during the call to redraw(). However,
    // some name settings we can apply here as they won't be affected by state changes.

    // The name width is set so that the text always stays inside the (cropped) icon of
    // the center item. The sqrt(2) is because the an iconCrop of 1 means that the entire
    // square icon is visible.
    const state    = MenuItemSettings.state.get(MenuItemState.CENTER);
    const nameSize = state.size * state.iconScale * state.iconCrop * Math.sqrt(2);
    this._name.set_size(nameSize, nameSize);
    this._name.set_color(MenuItemSettings.textColor);

    // Multiply the size of the font by globalScale. The Clutter.Text automatically obeys
    // the global scale, so we have to counter this here.
    const fontDescription = Pango.FontDescription.from_string(MenuItemSettings.font);
    const fontSize        = fontDescription.get_size();
    const hdpiScale       = utils.getHDPIScale();
    if (fontDescription.get_size_is_absolute()) {
      fontSize = Pango.units_from_double(fontSize);
    }
    fontDescription.set_size(fontSize * MenuItemSettings.globalScale / hdpiScale);
    this._name.set_font_description(fontDescription);

    // We also re-draw the trace line to the currently active child if there is any.
    if (this._trace != undefined) {
      this._trace.queue_repaint();
    }

    // Compute the icon container's size and position. We use the maximum size of all icon
    // variants.
    const maxSize = Math.max(
        MenuItemSettings.state.get(MenuItemState.CENTER).size,
        MenuItemSettings.state.get(MenuItemState.CENTER_HOVERED).size,
        MenuItemSettings.state.get(MenuItemState.CHILD).size,
        MenuItemSettings.state.get(MenuItemState.CHILD_HOVERED).size,
        MenuItemSettings.state.get(MenuItemState.GRANDCHILD).size,
        MenuItemSettings.state.get(MenuItemState.GRANDCHILD_HOVERED).size);

    const size2 = Math.floor(maxSize / 2);
    this._iconContainer.set_size(maxSize, maxSize);
    this._iconContainer.set_translation(-size2, -size2, 0);

    // Finally, call this recursively for all children.
    this._childrenContainer.get_children().forEach(child => child._onSettingsChange());
  }

  // This deletes all icon actors, triggering their recreation during the next call to
  // redraw(). This is used when settings are changed and when the icon property of this
  // is changed.
  _forceIconRecreation() {
    if (this._iconContainer) {
      this._iconContainer.destroy_all_children();
      delete this._iconContainer[MenuItemState.CENTER];
      delete this._iconContainer[MenuItemState.CENTER_HOVERED];
      delete this._iconContainer[MenuItemState.CHILD];
      delete this._iconContainer[MenuItemState.CHILD_HOVERED];
      delete this._iconContainer[MenuItemState.GRANDCHILD];
      delete this._iconContainer[MenuItemState.GRANDCHILD_HOVERED];
      delete this._averageIconColor;

      // Recreate existing icons with full opacity.
      this._forcedRecreation = true;
    }
  }
});
