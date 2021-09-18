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
// This creates a Demo Menu structure which is shown when the tutorial button is //
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
          // Translators: An emoji category of the example tutorial menu.
          name: _('Animals & Nature'),
          icon: '🌾',
          children: [
            {
              // Translators: An emoji category of the example tutorial menu.
              name: _('Flowers'),
              icon: '🥀',
              children: [
                // Translators: The name of the 🌷 emoji of the tutorial menu.
                {name: _('Tulip'), icon: '🌷'},
                // Translators: The name of the 🌹 emoji of the tutorial menu.
                {name: _('Rose'), icon: '🌹'},
                // Translators: The name of the 🌻 emoji of the tutorial menu.
                {name: _('Sunflower'), icon: '🌻'},
                // Translators: The name of the 🌼 emoji of the tutorial menu.
                {name: _('Blossom'), icon: '🌼'},
                // Translators: The name of the 💐 emoji of the tutorial menu.
                {name: _('Bouquet'), icon: '💐'},
              ]
            },
            {
              // Translators: An emoji category of the example tutorial menu.
              name: _('Mammals'),
              icon: '🐎',
              children: [
                // Translators: The name of the 🐈 emoji of the tutorial menu.
                {name: _('Cat'), icon: '🐈'},
                // Translators: The name of the 🐂 emoji of the tutorial menu.
                {name: _('Ox'), icon: '🐂'},
                // Translators: The name of the 🐕 emoji of the tutorial menu.
                {name: _('Dog'), icon: '🐕'},
                // Translators: The name of the 🐖 emoji of the tutorial menu.
                {name: _('Pig'), icon: '🐖'},
                // Translators: The name of the 🐒 emoji of the tutorial menu.
                {name: _('Monkey'), icon: '🐒'},
              ]
            },
            {
              // Translators: An emoji category of the example tutorial menu.
              name: _('Reptiles'),
              icon: '🦎',
              children: [
                // Translators: The name of the 🐊 emoji of the tutorial menu.
                {name: _('Crocodile'), icon: '🐊'},
                // Translators: The name of the 🐍 emoji of the tutorial menu.
                {name: _('Snake'), icon: '🐍'},
                // Translators: The name of the 🐢 emoji of the tutorial menu.
                {name: _('Turtle'), icon: '🐢'},
                // Translators: The name of the 🦖 emoji of the tutorial menu.
                {name: _('T-Rex'), icon: '🦖'},
                // Translators: The name of the 🦕 emoji of the tutorial menu.
                {name: _('Apatosaurus'), icon: '🦕'},
              ]
            },
          ]
        },
        {
          // Translators: An emoji category of the example tutorial menu.
          name: _('Food & Drink'),
          icon: '🍔',
          children: [
            {
              // Translators: An emoji category of the example tutorial menu.
              name: _('Fruit'),
              icon: '🥝',
              children: [
                // Translators: The name of the 🍏 emoji of the tutorial menu.
                {name: _('Apple'), icon: '🍏'},
                // Translators: The name of the 🍉 emoji of the tutorial menu.
                {name: _('Watermelon'), icon: '🍉'},
                // Translators: The name of the 🍋 emoji of the tutorial menu.
                {name: _('Lemon'), icon: '🍋'},
                // Translators: The name of the 🍌 emoji of the tutorial menu.
                {name: _('Banana'), icon: '🍌'},
                // Translators: The name of the 🍓 emoji of the tutorial menu.
                {name: _('Strawberry'), icon: '🍓'},
              ]
            },
            {
              // Translators: An emoji category of the example tutorial menu.
              name: _('Drink'),
              icon: '🍷',
              children: [
                // Translators: The name of the 🍵 emoji of the tutorial menu.
                {name: _('Tea'), icon: '🍵'},
                // Translators: The name of the ☕ emoji of the tutorial menu.
                {name: _('Coffee'), icon: '☕'},
                // Translators: The name of the 🍺 emoji of the tutorial menu.
                {name: _('Beer'), icon: '🍺'},
                // Translators: The name of the 🥃 emoji of the tutorial menu.
                {name: _('Whiskey'), icon: '🥃'},
                // Translators: The name of the 🍹 emoji of the tutorial menu.
                {name: _('Cocktail'), icon: '🍹'},
              ]
            },
            {
              // Translators: An emoji category of the example tutorial menu.
              name: _('Sweets'),
              icon: '🍭',
              children: [
                // Translators: This is the item which should be selected in the tutorial.
                // Make sure the translation matches the name given in the tutorial!
                // Translators: The name of the 🍰 emoji of the tutorial menu.
                {name: _('Shortcake'), icon: '🍰'},
                // Translators: The name of the 🍬 emoji of the tutorial menu.
                {name: _('Candy'), icon: '🍬'},
                // Translators: The name of the 🍩 emoji of the tutorial menu.
                {name: _('Doughnut'), icon: '🍩'},
                // Translators: The name of the 🍪 emoji of the tutorial menu.
                {name: _('Cookie'), icon: '🍪'},
                // Translators: The name of the 🍫 emoji of the tutorial menu.
                {name: _('Chocolate'), icon: '🍫'},
              ]
            },
          ]
        },
        {
          // Translators: An emoji category of the example tutorial menu.
          name: _('Activities'),
          icon: '🏆',
          children: [
            {
              // Translators: An emoji category of the example tutorial menu.
              name: _('Games'),
              icon: '🎲',
              children: [
                // Translators: The name of the 🎱 emoji of the tutorial menu.
                {name: _('Billards'), icon: '🎱'},
                // Translators: The name of the 🀄 emoji of the tutorial menu.
                {name: _('Mahjong'), icon: '🀄'},
                // Translators: The name of the 🎳 emoji of the tutorial menu.
                {name: _('Bowling'), icon: '🎳'},
                // Translators: The name of the 🎯 emoji of the tutorial menu.
                {name: _('Darts'), icon: '🎯'},
                // Translators: The name of the 🎮 emoji of the tutorial menu.
                {name: _('Video Game'), icon: '🎮'},
              ]
            },
            {
              // Translators: An emoji category of the example tutorial menu.
              name: _('Sports'),
              icon: '⚽',
              children: [
                // Translators: The name of the 🏏 emoji of the tutorial menu.
                {name: _('Cricket'), icon: '🏏'},
                // Translators: The name of the 🏒 emoji of the tutorial menu.
                {name: _('Ice Hockey'), icon: '🏒'},
                // Translators: The name of the 🎾 emoji of the tutorial menu.
                {name: _('Tennis'), icon: '🎾'},
                // Translators: The name of the 🎣 emoji of the tutorial menu.
                {name: _('Fishing'), icon: '🎣'},
                // Translators: The name of the 🎿 emoji of the tutorial menu.
                {name: _('Skiing'), icon: '🎿'},
              ]
            },
            {
              // Translators: An emoji category of the example tutorial menu.
              name: _('Places'),
              icon: '🗼',
              children: [
                // Translators: The name of the 🗻 emoji of the tutorial menu.
                {name: _('Mount Fuji'), icon: '🗻'},
                // Translators: The name of the 🌋 emoji of the tutorial menu.
                {name: _('Mount Etna'), icon: '🌋'},
                // Translators: The name of the 🗽 emoji of the tutorial menu.
                {name: _('Statue of Liberty'), icon: '🗽'},
                // Translators: The name of the 🗾 emoji of the tutorial menu.
                {name: _('Japan'), icon: '🗾'},
                // Translators: The name of the 🗿 emoji of the tutorial menu.
                {name: _('Moyai'), icon: '🗿'},
              ]
            },
          ]
        },
        {
          // Translators: An emoji category of the example tutorial menu.
          name: _('Objects'),
          icon: '🚜',
          children: [
            {
              // Translators: An emoji category of the example tutorial menu.
              name: _('Cars'),
              icon: '🚔',
              children: [
                // Translators: The name of the 🚌 emoji of the tutorial menu.
                {name: _('Bus'), icon: '🚌'},
                // Translators: The name of the 🚒 emoji of the tutorial menu.
                {name: _('Fire Engine'), icon: '🚒'},
                // Translators: The name of the 🚗 emoji of the tutorial menu.
                {name: _('Automobile'), icon: '🚗'},
                // Translators: The name of the 🚜 emoji of the tutorial menu.
                {name: _('Tractor'), icon: '🚜'},
                // Translators: The name of the 🚚 emoji of the tutorial menu.
                {name: _('Truck'), icon: '🚚'},
              ]
            },
            {
              // Translators: An emoji category of the example tutorial menu.
              name: _('Buildings'),
              icon: '🏢',
              children: [
                // Translators: The name of the 🏤 emoji of the tutorial menu.
                {name: _('Post Office'), icon: '🏤'},
                // Translators: The name of the 🏫 emoji of the tutorial menu.
                {name: _('School'), icon: '🏫'},
                // Translators: The name of the 🏥 emoji of the tutorial menu.
                {name: _('Hospital'), icon: '🏥'},
                // Translators: The name of the 🏦 emoji of the tutorial menu.
                {name: _('Bank'), icon: '🏦'},
                // Translators: The name of the 🏩 emoji of the tutorial menu.
                {name: _('Love Hotel'), icon: '🏩'},
              ]
            },
            {
              // Translators: An emoji category of the example tutorial menu.
              name: _('Instruments'),
              icon: '🎻',
              children: [
                // Translators: The name of the 🎷 emoji of the tutorial menu.
                {name: _('Saxophone'), icon: '🎷'},
                // Translators: The name of the 🎸 emoji of the tutorial menu.
                {name: _('Guitar'), icon: '🎸'},
                // Translators: The name of the 🎺 emoji of the tutorial menu.
                {name: _('Trumpet'), icon: '🎺'},
                // Translators: The name of the 🎤 emoji of the tutorial menu.
                {name: _('Microphone'), icon: '🎤'},
                // Translators: The name of the 🥁 emoji of the tutorial menu.
                {name: _('Drum'), icon: '🥁'},
              ]
            },
          ]
        },
        {
          // Translators: An emoji category of the example tutorial menu.
          name: _('Smileys'),
          icon: '😀',
          children: [
            {
              // Translators: An emoji category of the example tutorial menu.
              name: _('Happy Faces'),
              icon: '😁',
              children: [
                // Translators: The name of the 😃 emoji of the tutorial menu.
                {name: _('Smiley'), icon: '😃'},
                // Translators: The name of the 😉 emoji of the tutorial menu.
                {name: _('Winking Face'), icon: '😉'},
                // Translators: The name of the 😊 emoji of the tutorial menu.
                {name: _('Face With Smiling Eyes'), icon: '😊'},
                // Translators: The name of the 😅 emoji of the tutorial menu.
                {name: _('Face With Sweat'), icon: '😅'},
                // Translators: The name of the 🤣 emoji of the tutorial menu.
                {name: _('ROFL'), icon: '🤣'},
              ]
            },
            {
              // Translators: An emoji category of the example tutorial menu.
              name: _('Angry Faces'),
              icon: '😕',
              children: [
                // Translators: The name of the 🤮 emoji of the tutorial menu.
                {name: _('Vomiting Face'), icon: '🤮'},
                // Translators: The name of the 🤨 emoji of the tutorial menu.
                {name: _('Skeptical Face'), icon: '🤨'},
                // Translators: The name of the 😡 emoji of the tutorial menu.
                {name: _('Pouting Face'), icon: '😡'},
                // Translators: The name of the 😠 emoji of the tutorial menu.
                {name: _('Angry Face'), icon: '😠'},
                // Translators: The name of the 🤬 emoji of the tutorial menu.
                {name: _('Very Angry Face'), icon: '🤬'},
              ]
            },
            {
              // Translators: An emoji category of the example tutorial menu.
              name: _('Surprised Faces'),
              icon: '😯',
              children: [
                // Translators: The name of the 😳 emoji of the tutorial menu.
                {name: _('Flushed Face'), icon: '😳'},
                // Translators: The name of the 😧 emoji of the tutorial menu.
                {name: _('Anguished Face'), icon: '😧'},
                // Translators: The name of the 😲 emoji of the tutorial menu.
                {name: _('Astonished Face'), icon: '😲'},
                // Translators: The name of the 😱 emoji of the tutorial menu.
                {name: _('Screaming Face'), icon: '😱'},
                // Translators: The name of the 🤯 emoji of the tutorial menu.
                {name: _('Pouff'), icon: '🤯'},
              ]
            },
          ]
        },
        {
          // Translators: An emoji category of the example tutorial menu.
          name: _('Symbols'),
          icon: '♍',
          children: [
            {
              // Translators: An emoji category of the example tutorial menu.
              name: _('Star Signs'),
              icon: '♈',
              children: [
                // Translators: The name of the ♉ emoji of the tutorial menu.
                {name: _('Taurus'), icon: '♉'},
                // Translators: The name of the ♋ emoji of the tutorial menu.
                {name: _('Cancer'), icon: '♋'},
                // Translators: The name of the ♍ emoji of the tutorial menu.
                {name: _('Virgo'), icon: '♍'},
                // Translators: The name of the ♏ emoji of the tutorial menu.
                {name: _('Scorpius'), icon: '♏'},
                // Translators: The name of the ♑ emoji of the tutorial menu.
                {name: _('Capricorn'), icon: '♑'},
              ]
            },
            {
              // Translators: An emoji category of the example tutorial menu.
              name: _('Arrows'),
              icon: '🔁',
              children: [
                // Translators: The name of the ⏫ emoji of the tutorial menu.
                {name: _('Up'), icon: '⏫'},
                // Translators: The name of the ⏩ emoji of the tutorial menu.
                {name: _('Right'), icon: '⏩'},
                // Translators: The name of the 🔀 emoji of the tutorial menu.
                {name: _('Twisted'), icon: '🔀'},
                // Translators: The name of the ⏬ emoji of the tutorial menu.
                {name: _('Down'), icon: '⏬'},
                // Translators: The name of the ⏪ emoji of the tutorial menu.
                {name: _('Left'), icon: '⏪'},
              ]
            },
            {
              // Translators: An emoji category of the example tutorial menu.
              name: _('Info Signs'),
              icon: '🚻',
              children: [
                // Translators: The name of the 🚮 emoji of the tutorial menu.
                {name: _('Litter Bin'), icon: '🚮'},
                // Translators: The name of the 🚰 emoji of the tutorial menu.
                {name: _('Potable Water'), icon: '🚰'},
                // Translators: The name of the 🚹 emoji of the tutorial menu.
                {name: _('Mens'), icon: '🚹'},
                // Translators: The name of the 🚺 emoji of the tutorial menu.
                {name: _('Womens'), icon: '🚺'},
                // Translators: The name of the 🚼 emoji of the tutorial menu.
                {name: _('Baby'), icon: '🚼'},
              ]
            },
          ]
        },
      ]
    }
  }
}