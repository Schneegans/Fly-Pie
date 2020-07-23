//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

// This creates a Demo Menu structure which is shown when the preview button is pressed.

var ExampleMenu = class ExampleMenu {

  static get() {
    return {
      name: 'Example Menu', icon: 'firefox', children: [
        {
          name: 'Smileys & People',
          icon: '😀',
          children: [
            {
              name: 'Happy Faces',
              icon: '😁',
              children: [
                {name: 'Smiley', icon: '😃'},
                {name: 'Winking Face', icon: '😉'},
                {name: 'Face With Smiling Eyes', icon: '😊'},
                {name: 'Face With Sweat', icon: '😅'},
                {name: 'ROFL', icon: '🤣'},
              ]
            },
            {
              name: 'Angry Faces',
              icon: '😕',
              children: [
                {name: 'Vomiting Face', icon: '🤮'},
                {name: 'Skeptical Face', icon: '🤨'},
                {name: 'Pouting Face', icon: '😡'},
                {name: 'Angry Face', icon: '😠'},
                {name: 'Very Angry Face', icon: '🤬'},
              ]
            },
            {
              name: 'Surprised Faces',
              icon: '😯',
              children: [
                {name: 'Flushed Face', icon: '😳'},
                {name: 'Anguished Face', icon: '😧'},
                {name: 'Astonished Face', icon: '😲'},
                {name: 'Screaming Face', icon: '😱'},
                {name: 'Pouff', icon: '🤯'},
              ]
            },
          ]
        },
        {
          name: 'Animals & Nature',
          icon: '🌾',
          children: [
            {
              name: 'Flowers',
              icon: '🥀',
              children: [
                {name: 'Tulip', icon: '🌷'},
                {name: 'Rose', icon: '🌹'},
                {name: 'Sunflower', icon: '🌻'},
                {name: 'Blossom', icon: '🌼'},
                {name: 'Bouquet', icon: '💐'},
              ]
            },
            {
              name: 'Mammals',
              icon: '🐎',
              children: [
                {name: 'Cat', icon: '🐈'},
                {name: 'Ox', icon: '🐂'},
                {name: 'Dog', icon: '🐕'},
                {name: 'Pig', icon: '🐖'},
                {name: 'Monkey', icon: '🐒'},
              ]
            },
            {
              name: 'Reptiles',
              icon: '🦎',
              children: [
                {name: 'Crocodile', icon: '🐊'},
                {name: 'Snake', icon: '🐍'},
                {name: 'Turtle', icon: '🐢'},
                {name: 'T-Rex', icon: '🦖'},
                {name: 'Apatosaurus', icon: '🦕'},
              ]
            },
          ]
        },
        {
          name: 'Food & Drink',
          icon: '🍔',
          children: [
            {
              name: 'Fruit',
              icon: '🥝',
              children: [
                {name: 'Apple', icon: '🍏'},
                {name: 'Watermelon', icon: '🍉'},
                {name: 'Lemon', icon: '🍋'},
                {name: 'Banana', icon: '🍌'},
                {name: 'Strawberry', icon: '🍓'},
              ]
            },
            {
              name: 'Drink',
              icon: '🍷',
              children: [
                {name: 'Teacup', icon: '🍵'},
                {name: 'Coffee', icon: '☕'},
                {name: 'Beer', icon: '🍺'},
                {name: 'Whiskey', icon: '🥃'},
                {name: 'Cocktail', icon: '🍹'},
              ]
            },
            {
              name: 'Sweets',
              icon: '🍭',
              children: [
                {name: 'Shortcake', icon: '🍰'},
                {name: 'Candy', icon: '🍬'},
                {name: 'Doughnut', icon: '🍩'},
                {name: 'Cookie', icon: '🍪'},
                {name: 'Chocolate', icon: '🍫'},
              ]
            },
          ]
        },
        {
          name: 'Activities',
          icon: '🏆',
          children: [
            {
              name: 'Games',
              icon: '🎲',
              children: [
                {name: 'Billards', icon: '🎱'},
                {name: 'Mahjong', icon: '🀄'},
                {name: 'Bowling', icon: '🎳'},
                {name: 'Darts', icon: '🎯'},
                {name: 'Video Game', icon: '🎮'},
              ]
            },
            {
              name: 'Sports',
              icon: '⚽',
              children: [
                {name: 'Cricket', icon: '🏏'},
                {name: 'Ice Hockey', icon: '🏒'},
                {name: 'Tennis', icon: '🎾'},
                {name: 'Fishing', icon: '🎣'},
                {name: 'Skiing', icon: '🎿'},
              ]
            },
            {
              name: 'Places',
              icon: '🗼',
              children: [
                {name: 'Mount Fuji', icon: '🗻'},
                {name: 'Mount Etna', icon: '🌋'},
                {name: 'Statue of Liberty', icon: '🗽'},
                {name: 'Japan', icon: '🗾'},
                {name: 'Moyai', icon: '🗿'},
              ]
            },
          ]
        },
        {
          name: 'Objects',
          icon: '🚜',
          children: [
            {
              name: 'Cars',
              icon: '🚔',
              children: [
                {name: 'Bus', icon: '🚌'},
                {name: 'Fire Engine', icon: '🚒'},
                {name: 'Automobile', icon: '🚗'},
                {name: 'Tractor', icon: '🚜'},
                {name: 'Truck', icon: '🚚'},
              ]
            },
            {
              name: 'Buildings',
              icon: '🏢',
              children: [
                {name: 'Post Office', icon: '🏤'},
                {name: 'School', icon: '🏫'},
                {name: 'Hospital', icon: '🏥'},
                {name: 'Bank', icon: '🏦'},
                {name: 'Love Hotel', icon: '🏩'},
              ]
            },
            {
              name: 'Instruments',
              icon: '🎻',
              children: [
                {name: 'Saxophone', icon: '🎷'},
                {name: 'Guitar', icon: '🎸'},
                {name: 'Trumpet', icon: '🎺'},
                {name: 'Microphone', icon: '🎤'},
                {name: 'Drum', icon: '🥁'},
              ]
            },
          ]
        },
        {
          name: 'Symbols',
          icon: '♍',
          children: [
            {
              name: 'Star Signs',
              icon: '♈',
              children: [
                {name: 'Taurus', icon: '♉'},
                {name: 'Cancer', icon: '♋'},
                {name: 'Virgo', icon: '♍'},
                {name: 'Scorpius', icon: '♏'},
                {name: 'Capricorn', icon: '♑'},
              ]
            },
            {
              name: 'Arrows',
              icon: '🔁',
              children: [
                {name: 'Up', icon: '⏫'},
                {name: 'Right', icon: '⏩'},
                {name: 'Twisted', icon: '🔀'},
                {name: 'Down', icon: '⏬'},
                {name: 'Left', icon: '⏪'},
              ]
            },
            {
              name: 'Info Signs',
              icon: '🚻',
              children: [
                {name: 'Litter Bin', icon: '🚮'},
                {name: 'Potable Watter', icon: '🚰'},
                {name: 'Mens', icon: '🚹'},
                {name: 'Womens', icon: '🚺'},
                {name: 'Baby', icon: '🚼'},
              ]
            },
          ]
        },
      ]
    }
  }
}