//////////////////////////////////////////////////////////////////////////////////////////
//   _____       _             _____ _                                                  //
//  |   __|_ _ _|_|___ ___ ___|  _  |_|___   This software may be modified and distri-  //
//  |__   | | | | |   | . |___|   __| | -_|  buted under the terms of the MIT license.  //
//  |_____|_____|_|_|_|_  |   |__|  |_|___|  See the LICENSE file for details.          //
//                    |___|                                                             //
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
              name: 'Hands',
              icon: '👋',
              children: [
                {name: 'Raised Hand', icon: '✋'},
                {name: 'Thumbs Up', icon: '👍'},
                {name: 'Thumbs Down', icon: '👎'},
                {name: 'Clapping Hands', icon: '👏'},
                {name: 'Horns', icon: '🤘'},
              ]
            },
            {
              name: 'Cloths',
              icon: '👕',
              children: [
                {name: 'Necktie', icon: '👔'},
                {name: 'Dress', icon: '👗'},
                {name: 'Bikini', icon: '👙'},
                {name: 'Cap', icon: '🧢'},
                {name: 'Socks', icon: '🧦'},
              ]
            },
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
          icon: '🌸',
          children: [
            {
              name: 'Trees',
              icon: '🍁🌲',
              children: [
                {name: 'Seedling', icon: '🌱'},
                {name: 'Evergreen Tree', icon: '🌲'},
                {name: 'Deciduous Tree', icon: '🌳'},
                {name: 'Palm Tree', icon: '🌴'},
                {name: 'Cactus', icon: '🌵'},
              ]
            },
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
              name: 'Fish',
              icon: '🐬',
              children: [
                {name: 'Whale', icon: '🐋'},
                {name: 'Shark', icon: '🦈'},
                {name: 'Tropical Fish', icon: '🐠'},
                {name: 'Blowfish', icon: '🐡'},
                {name: 'Octopus', icon: '🐙'},
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
                {name: 'Apathosaurus', icon: '🦕'},
              ]
            },
          ]
        },
        {
          name: 'Food & Drink',
          icon: '🌭',
          children: [
            {
              name: 'Fruit',
              icon: '🍏',
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
              icon: '☕',
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
              icon: '🍬',
              children: [
                {name: 'Shortcake', icon: '🍰'},
                {name: 'Candy', icon: '🍬'},
                {name: 'Doughnut', icon: '🍩'},
                {name: 'Cookie', icon: '🍪'},
                {name: 'Chocolate', icon: '🍫'},
              ]
            },
            {
              name: 'Vegetables',
              icon: '🍅',
              children: [
                {name: 'Tomato', icon: '🍅'},
                {name: 'Aubergine', icon: '🍆'},
                {name: 'Maize', icon: '🌽'},
                {name: 'Avocado', icon: '🥑'},
                {name: 'Cucumber', icon: '🥒'},
              ]
            },
            {
              name: 'Fast Food',
              icon: '🍔',
              children: [
                {name: 'Popcorn', icon: '🍿'},
                {name: 'French Fries', icon: '🍟'},
                {name: 'Burrito', icon: '🌯'},
                {name: 'Hamburger', icon: '🍔'},
                {name: 'Hot Dog', icon: '🌭'},
              ]
            },
          ]
        },
        {
          name: 'Activities',
          icon: '⚽',
          children: [
            {
              name: 'Balls',
              icon: '👍',
              children: [
                {name: 'Basketball', icon: '🏀'},
                {name: 'Football', icon: '🏈'},
                {name: 'Baseball', icon: '⚾'},
                {name: 'Soccer Ball', icon: '⚽'},
                {name: 'Volleyball', icon: '🏐'},
              ]
            },
            {
              name: 'Trophies',
              icon: '🏆',
              children: [
                {name: 'Golden Trophy', icon: '🏆'},
                {name: 'Sports Medal', icon: '🏅'},
                {name: 'First Place', icon: '🥇'},
                {name: 'Second Place', icon: '🥈'},
                {name: 'Third Place', icon: '🥉'},
              ]
            },
            {
              name: 'Sports',
              icon: '🎾',
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
                {name: 'Tokyo Tower', icon: '🗼'},
                {name: 'Statue of Liberty', icon: '🗽'},
                {name: 'Japan', icon: '🗾'},
                {name: 'Moyai', icon: '🗿'},
              ]
            },
            {
              name: 'Games',
              icon: '🎮',
              children: [
                {name: 'Billards', icon: '🎱'},
                {name: 'Dice', icon: '🎲'},
                {name: 'Bowling', icon: '🎳'},
                {name: 'Darts', icon: '🎯'},
                {name: 'Video Game', icon: '🎮'},
              ]
            },
          ]
        },
        {
          name: 'Objects',
          icon: '🏠🚗',
          children: [
            {
              name: 'Cars',
              icon: '🚗',
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
              name: 'Books',
              icon: '📔',
              children: [
                {name: 'Ledger', icon: '📒'},
                {name: 'Notebook', icon: '📓'},
                {name: 'Green Book', icon: '📗'},
                {name: 'Blue Book', icon: '📘'},
                {name: 'Orange Book', icon: '📙'},
              ]
            },
            {
              name: 'Devices',
              icon: '📱',
              children: [
                {name: 'Fax Machine', icon: '📠'},
                {name: 'Camera', icon: '📷'},
                {name: 'Television', icon: '📺'},
                {name: 'Radio', icon: '📻'},
                {name: 'Video Camera', icon: '📹'},
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
              name: 'Clocks',
              icon: '🕘',
              children: [
                {name: 'Two O\'Clock', icon: '🕑'},
                {name: 'Four O\'Clock', icon: '🕓'},
                {name: 'Six O\'Clock', icon: '🕕'},
                {name: 'Eight O\'Clock', icon: '🕗'},
                {name: 'Ten O\'Clock', icon: '🕥'},
              ]
            },
            {
              name: 'Moon States',
              icon: '🌖',
              children: [
                {name: 'New Moon', icon: '🌑'},
                {name: 'First Quarter', icon: '🌓'},
                {name: 'Full Moon', icon: '🌕'},
                {name: 'Last Quarter', icon: '🌗'},
                {name: 'Happy Moon', icon: '🌝'},
              ]
            },
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
                {name: 'Right', icon: '⏩'},
                {name: 'Down', icon: '⏬'},
                {name: 'Left', icon: '⏪'},
                {name: 'Up', icon: '⏫'},
                {name: 'Twisted', icon: '🔀'},
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