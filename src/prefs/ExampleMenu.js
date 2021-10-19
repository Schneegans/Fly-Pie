//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const {Clutter} = imports.gi;

const _ = imports.gettext.domain('flypie').gettext;

//////////////////////////////////////////////////////////////////////////////////////////
// This creates a Demo Menu structure which is shown when the tutorial button is        //
// pressed. The menu is quite symmetrical, the root menu has 6 items, each of them has  //
// five children. These children again have five children. This makes a total of 125    //
// leaf items.                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////

var Levels = [
  {
    // Translators: The tutorial menu allows selecting triplets such as "Smelly Chocolate
    // Muffin". This is one of the first words. The three words are directly appended to
    // each other; therefore the trailing space is important. You can also use hyphens if
    // appropriate.
    names: [_('Wet '), _('Hot '), _('Cold '), _('Deadly '), _('Smelly '), _('Vegan ')],
    icons: [
      'flypie-wet-symbolic-#349', 'flypie-hot-symbolic-#b42', 'flypie-cold-symbolic-#68c',
      'flypie-deadly-symbolic-#523', 'flypie-smelly-symbolic-#aa5',
      'flypie-vegan-symbolic-#4a4'
    ]
  },
  {
    // Translators: The tutorial menu allows selecting triplets such as "Smelly Chocolate
    // Muffin". This is one of the middle words. The three words are directly appended to
    // each other; therefore the trailing space is important. You can also use hyphens if
    // appropriate.
    names: [_('Chocolate '), _('Cherry '), _('Apple '), _('Garlic '), _('Pepper ')],
    icons: [
      'flypie-wet-symbolic-#432', 'flypie-hot-symbolic-#a47', 'flypie-cold-symbolic-#5a3',
      'flypie-garlic-symbolic-#a88', 'flypie-pepper-symbolic-#a44'
    ]
  },
  {
    // Translators: The tutorial menu allows selecting triplets such as "Smelly Chocolate
    // Muffin". This is one of the last words. The three words are directly appended to
    // each other; therefore the trailing space is important. You can also use hyphens if
    // appropriate.
    names: [_('Cake'), _('Doughnut'), _('Muffin'), _('Cookie'), _('Pie')],
    icons: [
      'flypie-wet-symbolic-#baa', 'flypie-hot-symbolic-#67c', 'flypie-cold-symbolic-#973',
      'flypie-deadly-symbolic-#643', 'flypie-cold-symbolic-#526'
    ]
  }
];

var ExampleMenu = class ExampleMenu {

  // ---------------------------------------------------------------------- static methods

  static get() {

    // Translators: This is the name of the tutorial menu.
    const menu = {name: _('Example Menu'), icon: 'flypie-symbolic-#96a', children: []};

    for (let i = 0; i < Levels[0].names.length; i++) {

      const child = {name: Levels[0].names[i], icon: Levels[0].icons[i], children: []};
      menu.children.push(child);

      for (let i = 0; i < Levels[1].names.length; i++) {
        const grandchild = {
          name: child.name + Levels[1].names[i],
          icon: Levels[1].icons[i],
          children: []
        };
        child.children.push(grandchild);

        for (let i = 0; i < Levels[2].names.length; i++) {
          const grandgrandchild = {
            name: grandchild.name + Levels[2].names[i],
            icon: Levels[2].icons[i],
          };
          grandchild.children.push(grandgrandchild);
        }
      }
    }

    return menu;
  }
}