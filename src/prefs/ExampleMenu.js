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
// This creates a Demo Menu structure which is shown when the tutorial button is        //
// pressed. The menu is quite symmetrical, the root menu has 6 items, each of them has  //
// five children. These children again have five children. This makes a total of 125    //
// leaf items.                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////

var ExampleMenu = class ExampleMenu {

  // ---------------------------------------------------------------------- static methods

  static get() {

    // Translators: This is the name of the tutorial menu.
    const menu  = {name: _('Example Menu'), icon: 'flypie-symbolic-#555', children: []};
    const items = this.getItems();

    for (let i = 0; i < items[0].names.length; i++) {

      const child = {name: items[0].names[i], icon: items[0].icons[i], children: []};
      menu.children.push(child);

      for (let i = 0; i < items[1].names.length; i++) {
        const grandchild = {
          name: child.name + items[1].names[i],
          icon: items[1].icons[i],
          children: []
        };
        child.children.push(grandchild);

        for (let i = 0; i < items[2].names.length; i++) {
          const grandgrandchild = {
            name: grandchild.name + items[2].names[i],
            icon: items[2].icons[i],
          };
          grandchild.children.push(grandgrandchild);
        }
      }
    }

    return menu;
  }

  // Is there a way to assign the same gettext comment to multiple strings...?
  static getItems() {
    // clang-format off
    return [
      {
        names: [
          // Translators: The tutorial menu allows selecting triplets such as "Smelly
          // Chocolate Muffin". This is one of the first words. The three words are directly
          // appended to each other; therefore the trailing space is important. You can also
          // use hyphens if appropriate.
          _('Cold '),
          // Translators: The tutorial menu allows selecting triplets such as "Smelly
          // Chocolate Muffin". This is one of the first words. The three words are directly
          // appended to each other; therefore the trailing space is important. You can also
          // use hyphens if appropriate.
         _('Hot '),
          // Translators: The tutorial menu allows selecting triplets such as "Smelly
          // Chocolate Muffin". This is one of the first words. The three words are directly
          // appended to each other; therefore the trailing space is important. You can also
          // use hyphens if appropriate.
          _('Wet '),
          // Translators: The tutorial menu allows selecting triplets such as "Smelly
          // Chocolate Muffin". This is one of the first words. The three words are directly
          // appended to each other; therefore the trailing space is important. You can also
          // use hyphens if appropriate.
          _('Deadly '),
          // Translators: The tutorial menu allows selecting triplets such as "Smelly
          // Chocolate Muffin". This is one of the first words. The three words are directly
          // appended to each other; therefore the trailing space is important. You can also
          // use hyphens if appropriate.
          _('Smelly '),
          // Translators: The tutorial menu allows selecting triplets such as "Smelly
          // Chocolate Muffin". This is one of the first words. The three words are directly
          // appended to each other; therefore the trailing space is important. You can also
          // use hyphens if appropriate.
          _('Vegan ')
        ],
        icons: [
          'flypie-cold-symbolic-#68c', 'flypie-hot-symbolic-#b42',
          'flypie-wet-symbolic-#349', 'flypie-deadly-symbolic-#523',
          'flypie-smelly-symbolic-#aa5', 'flypie-vegan-symbolic-#4a4'
        ]
      },
      {
        names: [
          // Translators: The tutorial menu allows selecting triplets such as "Smelly
          // Chocolate Muffin". This is one of the middle words. The three words are
          // directly appended to each other; therefore the trailing space is important. You
          // can also use hyphens if appropriate.
          _('Chocolate '),
          // Translators: The tutorial menu allows selecting triplets such as "Smelly
          // Chocolate Muffin". This is one of the middle words. The three words are
          // directly appended to each other; therefore the trailing space is important. You
          // can also use hyphens if appropriate.
          _('Cherry '),
          // Translators: The tutorial menu allows selecting triplets such as "Smelly
          // Chocolate Muffin". This is one of the middle words. The three words are
          // directly appended to each other; therefore the trailing space is important. You
          // can also use hyphens if appropriate.
          _('Garlic '),
          // Translators: The tutorial menu allows selecting triplets such as "Smelly
          // Chocolate Muffin". This is one of the middle words. The three words are
          // directly appended to each other; therefore the trailing space is important. You
          // can also use hyphens if appropriate.
          _('Apple '),
          // Translators: The tutorial menu allows selecting triplets such as "Smelly
          // Chocolate Muffin". This is one of the middle words. The three words are
          // directly appended to each other; therefore the trailing space is important. You
          // can also use hyphens if appropriate.
          _('Pepper ')
        ],
        icons: [
          'flypie-chocolate-symbolic-#432', 'flypie-cherry-symbolic-#a47',
          'flypie-garlic-symbolic-#a88', 'flypie-apple-symbolic-#5a3',
          'flypie-pepper-symbolic-#a44'
        ]
      },
      {
        names: [
          // Translators: The tutorial menu allows selecting triplets such as "Smelly
          // Chocolate Muffin". This is one of the last words. The three words are directly
          // appended to each other; therefore the trailing space is important. You can also
          // use hyphens if appropriate.
          _('Pie'),
          // Translators: The tutorial menu allows selecting triplets such as "Smelly
          // Chocolate Muffin". This is one of the last words. The three words are directly
          // appended to each other; therefore the trailing space is important. You can also
          // use hyphens if appropriate.
          _('Cake'),
          // Translators: The tutorial menu allows selecting triplets such as "Smelly
          // Chocolate Muffin". This is one of the last words. The three words are directly
          // appended to each other; therefore the trailing space is important. You can also
          // use hyphens if appropriate.
          _('Muffin'),
          // Translators: The tutorial menu allows selecting triplets such as "Smelly
          // Chocolate Muffin". This is one of the last words. The three words are directly
          // appended to each other; therefore the trailing space is important. You can also
          // use hyphens if appropriate.
          _('Doughnut'),
          // Translators: The tutorial menu allows selecting triplets such as "Smelly
          // Chocolate Muffin". This is one of the last words. The three words are directly
          // appended to each other; therefore the trailing space is important. You can also
          // use hyphens if appropriate.
          _('Cookie')
        ],
        icons: [
          'flypie-pie-symbolic-#526', 'flypie-cake-symbolic-#baa',
          'flypie-muffin-symbolic-#973', 'flypie-doughnut-symbolic-#67c',
          'flypie-cookie-symbolic-#643'
        ]
      }
    ];
    // clang-format on
  }
}