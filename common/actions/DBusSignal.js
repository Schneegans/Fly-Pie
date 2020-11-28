//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const _ = imports.gettext.domain('flypie').gettext;

const Me    = imports.misc.extensionUtils.getCurrentExtension();
const Enums = Me.imports.common.Enums;

//////////////////////////////////////////////////////////////////////////////////////////
// The D-Bus signal action does nothing. It is actually something like a dummy action.  //
// But sometimes you will just require the emission of the OnSelect D-Bus signal.       //
// See common/ItemRegistry.js for a description of the action's format.                 //
//////////////////////////////////////////////////////////////////////////////////////////

var action = {
  name: _('D-Bus Signal'),
  icon: 'application-x-addon',
  subtitle: _('Emits a D-Bus signal.'),
  description: _(
      'The <b>D-Bus Signal</b> action does nothing on its own. But you <a href="https://github.com/Schneegans/Fly-Pie#fly-pies-d-bus-interface">can listen on the D-Bus for its activation</a>. This can be very useful in custom menus opened via the command line.'),
  itemClass: Enums.ItemClass.ACTION,
  dataType: Enums.ItemDataType.ID,
  defaultData: '',
  createItem: (data) => {
    return {id: data, activate: () => {}};
  }
};