//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const _ = imports.gettext.domain('flypie').gettext;

//////////////////////////////////////////////////////////////////////////////////////////
// This creates a Demo Menu structure which is shown when the preview button is         //
// pressed. The menu is quite symmetrical, the root menu has 6 items, each of them has  //
// three children. These children again have five children. This makes a total of 90    //
// leaf items.                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////

var ExampleMenu = class ExampleMenu {

  // ---------------------------------------------------------------------- static methods

  static get() {
    return {
      name: _('Example Menu'), icon: '😷', children: [
        {
          // Translators: An emoji category.
          name: _('Animals & Nature'),
          icon: '🌾',
          children: [
            {
              name: _('Flowers'),
              icon: '🥀',
              children: [
                {name: _('Tulip'), icon: '🌷'},
                {name: _('Rose'), icon: '🌹'},
                {name: _('Sunflower'), icon: '🌻'},
                {name: _('Blossom'), icon: '🌼'},
                {name: _('Bouquet'), icon: '💐'},
              ]
            },
            {
              // Translators: An emoji category.
              name: _('Mammals'),
              icon: '🐎',
              children: [
                {name: _('Cat'), icon: '🐈'},
                {name: _('Ox'), icon: '🐂'},
                {name: _('Dog'), icon: '🐕'},
                {name: _('Pig'), icon: '🐖'},
                {name: _('Monkey'), icon: '🐒'},
              ]
            },
            {
              // Translators: An emoji category.
              name: _('Reptiles'),
              icon: '🦎',
              children: [
                {name: _('Crocodile'), icon: '🐊'},
                {name: _('Snake'), icon: '🐍'},
                {name: _('Turtle'), icon: '🐢'},
                {name: _('T-Rex'), icon: '🦖'},
                {name: _('Apatosaurus'), icon: '🦕'},
              ]
            },
          ]
        },
        {
          // Translators: An emoji category.
          name: _('Food & Drink'),
          icon: '🍔',
          children: [
            {
              // Translators: An emoji category.
              name: _('Fruit'),
              icon: '🥝',
              children: [
                {name: _('Apple'), icon: '🍏'},
                {name: _('Watermelon'), icon: '🍉'},
                {name: _('Lemon'), icon: '🍋'},
                {name: _('Banana'), icon: '🍌'},
                {name: _('Strawberry'), icon: '🍓'},
              ]
            },
            {
              // Translators: An emoji category.
              name: _('Drink'),
              icon: '🍷',
              children: [
                {name: _('Tea'), icon: '🍵'},
                {name: _('Coffee'), icon: '☕'},
                {name: _('Beer'), icon: '🍺'},
                {name: _('Whiskey'), icon: '🥃'},
                {name: _('Cocktail'), icon: '🍹'},
              ]
            },
            {
              // Translators: An emoji category.
              name: _('Sweets'),
              icon: '🍭',
              children: [
                // Translators: This is the item which should be selected in the tutorial.
                // Make sure the translation matches the name given in the tutorial!
                {name: _('Shortcake'), icon: '🍰'},
                {name: _('Candy'), icon: '🍬'},
                {name: _('Doughnut'), icon: '🍩'},
                {name: _('Cookie'), icon: '🍪'},
                {name: _('Chocolate'), icon: '🍫'},
              ]
            },
          ]
        },
        {
          // Translators: An emoji category.
          name: _('Activities'),
          icon: '🏆',
          children: [
            {
              // Translators: An emoji category.
              name: _('Games'),
              icon: '🎲',
              children: [
                {name: _('Billards'), icon: '🎱'},
                {name: _('Mahjong'), icon: '🀄'},
                {name: _('Bowling'), icon: '🎳'},
                {name: _('Darts'), icon: '🎯'},
                {name: _('Video Game'), icon: '🎮'},
              ]
            },
            {
              // Translators: An emoji category.
              name: _('Sports'),
              icon: '⚽',
              children: [
                {name: _('Cricket'), icon: '🏏'},
                {name: _('Ice Hockey'), icon: '🏒'},
                {name: _('Tennis'), icon: '🎾'},
                {name: _('Fishing'), icon: '🎣'},
                {name: _('Skiing'), icon: '🎿'},
              ]
            },
            {
              // Translators: An emoji category.
              name: _('Places'),
              icon: '🗼',
              children: [
                {name: _('Mount Fuji'), icon: '🗻'},
                {name: _('Mount Etna'), icon: '🌋'},
                {name: _('Statue of Liberty'), icon: '🗽'},
                {name: _('Japan'), icon: '🗾'},
                {name: _('Moyai'), icon: '🗿'},
              ]
            },
          ]
        },
        {
          // Translators: An emoji category.
          name: _('Objects'),
          icon: '🚜',
          children: [
            {
              // Translators: An emoji category.
              name: _('Cars'),
              icon: '🚔',
              children: [
                {name: _('Bus'), icon: '🚌'},
                {name: _('Fire Engine'), icon: '🚒'},
                {name: _('Automobile'), icon: '🚗'},
                {name: _('Tractor'), icon: '🚜'},
                {name: _('Truck'), icon: '🚚'},
              ]
            },
            {
              // Translators: An emoji category.
              name: _('Buildings'),
              icon: '🏢',
              children: [
                {name: _('Post Office'), icon: '🏤'},
                {name: _('School'), icon: '🏫'},
                {name: _('Hospital'), icon: '🏥'},
                {name: _('Bank'), icon: '🏦'},
                {name: _('Love Hotel'), icon: '🏩'},
              ]
            },
            {
              // Translators: An emoji category.
              name: _('Instruments'),
              icon: '🎻',
              children: [
                {name: _('Saxophone'), icon: '🎷'},
                {name: _('Guitar'), icon: '🎸'},
                {name: _('Trumpet'), icon: '🎺'},
                {name: _('Microphone'), icon: '🎤'},
                {name: _('Drum'), icon: '🥁'},
              ]
            },
          ]
        },
        {
          // Translators: An emoji category.
          name: _('Smileys'),
          icon: '😀',
          children: [
            {
              // Translators: An emoji category.
              name: _('Happy Faces'),
              icon: '😁',
              children: [
                {name: _('Smiley'), icon: '😃'},
                {name: _('Winking Face'), icon: '😉'},
                {name: _('Face With Smiling Eyes'), icon: '😊'},
                {name: _('Face With Sweat'), icon: '😅'},
                {name: _('ROFL'), icon: '🤣'},
              ]
            },
            {
              // Translators: An emoji category.
              name: _('Angry Faces'),
              icon: '😕',
              children: [
                {name: _('Vomiting Face'), icon: '🤮'},
                {name: _('Skeptical Face'), icon: '🤨'},
                {name: _('Pouting Face'), icon: '😡'},
                {name: _('Angry Face'), icon: '😠'},
                {name: _('Very Angry Face'), icon: '🤬'},
              ]
            },
            {
              // Translators: An emoji category.
              name: _('Surprised Faces'),
              icon: '😯',
              children: [
                {name: _('Flushed Face'), icon: '😳'},
                {name: _('Anguished Face'), icon: '😧'},
                {name: _('Astonished Face'), icon: '😲'},
                {name: _('Screaming Face'), icon: '😱'},
                {name: _('Pouff'), icon: '🤯'},
              ]
            },
          ]
        },
        {
          // Translators: An emoji category.
          name: _('Symbols'),
          icon: '♍',
          children: [
            {
              // Translators: An emoji category.
              name: _('Star Signs'),
              icon: '♈',
              children: [
                {name: _('Taurus'), icon: '♉'},
                {name: _('Cancer'), icon: '♋'},
                {name: _('Virgo'), icon: '♍'},
                {name: _('Scorpius'), icon: '♏'},
                {name: _('Capricorn'), icon: '♑'},
              ]
            },
            {
              // Translators: An emoji category.
              name: _('Arrows'),
              icon: '🔁',
              children: [
                {name: _('Up'), icon: '⏫'},
                {name: _('Right'), icon: '⏩'},
                {name: _('Twisted'), icon: '🔀'},
                {name: _('Down'), icon: '⏬'},
                {name: _('Left'), icon: '⏪'},
              ]
            },
            {
              // Translators: An emoji category.
              name: _('Info Signs'),
              icon: '🚻',
              children: [
                {name: _('Litter Bin'), icon: '🚮'},
                {name: _('Potable Water'), icon: '🚰'},
                {name: _('Mens'), icon: '🚹'},
                {name: _('Womens'), icon: '🚺'},
                {name: _('Baby'), icon: '🚼'},
              ]
            },
          ]
        },
      ]
    }
  }
}