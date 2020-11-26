//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

//////////////////////////////////////////////////////////////////////////////////////////
// Each item type has one settings type - this determines which widgets are visible     //
// when an item of this type is selected in the settings dialog. If you create a new    //
// item type, this list may have to be extended. This will also require some changes to //
// the MenuEditor.js as this is responsible for showing and hiding the widgets          //
// accordingly.                                                                         //
//////////////////////////////////////////////////////////////////////////////////////////

var ItemDataType = {
  NONE: 0,
  MENU: 1,
  SUBMENU: 2,
  SHORTCUT: 3,
  COMMAND: 4,
  FILE: 5,
  URL: 6,
  COUNT: 7,
  TEXT: 8,
  ID: 9,
};