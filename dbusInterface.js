//////////////////////////////////////////////////////////////////////////////////////////
//                                                                                      //
//    _____                    ___  _     ___       This software may be modified       //
//   / ___/__  ___  __ _  ___ / _ \(_)__ |_  |      and distributed under the           //
//  / (_ / _ \/ _ \/  ' \/ -_) ___/ / -_) __/       terms of the MIT license. See       //
//  \___/_//_/\___/_/_/_/\__/_/  /_/\__/____/       the LICENSE file for details.       //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

//////////////////////////////////////////////////////////////////////////////////////////
// First, you should call the ShowMenu method. As argument a menu description has to    //
// be provided. This is a JSON string like this:                                        //
//                                                                                      //
//   {                                                                                  //
//    'items':[{                                                                        //
//      'name':'Item Title 1',                                                          //
//      'icon':'icon-name-or-path',                                                     //
//      'items':[{                                                                      //
//          'name':'Item Title 11',                                                     //
//          'icon':'icon-name-or-path'                                                  //
//        },{                                                                           //
//          'name':'Item Title 12',                                                     //
//          'icon':'icon-name-or-path'                                                  //
//      }]},{                                                                           //
//        'name':'Item Title 2',                                                        //
//        'icon':'icon-name-or-path'                                                    //
//      },{                                                                             //
//        'name':'Item Title 3',                                                        //
//        'icon':'icon-name-or-path'                                                    //
//      }]                                                                              //
//    }                                                                                 //
//                                                                                      //
// The returned integer is either negative (the server failed to parse the provided     //
// description) or a positive ID which will be passed to the signals of the interface.  //
// There are two signals; OnCancel will be fired when the user aborts the selection in  //
// a menu, OnSelect is activated when the user makes a selection. Both signals send     //
// the ID which has been reported by the corresponding ShowMenu call, in addition       //
// OnSelect sends the path to the selected item. Like this: '/0/1'                      //
//////////////////////////////////////////////////////////////////////////////////////////

const DBusInterface = '<node>                               \
    <interface name="org.openpie.Daemon.MenuService">       \
      <method name="ShowMenu">                              \
        <arg name="description" type="s" direction="in"/>   \
      </method>                                             \
      <method name="ShowSettings">                          \
      </method>                                             \
      <signal name="OnSelect">                              \
          <arg name="path" type="s"/>                       \
      </signal>                                             \
      <signal name="OnHover">                               \
          <arg name="path" type="s"/>                       \
      </signal>                                             \
      <signal name="OnCancel">                              \
      </signal>                                             \
    </interface>                                            \
  </node>';
