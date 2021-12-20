//////////////////////////////////////////////////////////////////////////////////////////
//        ___            _     ___                                                      //
//        |   |   \/    | ) |  |           This software may be modified and distri-    //
//    O-  |-  |   |  -  |   |  |-  -O      buted under the terms of the MIT license.    //
//        |   |_  |     |   |  |_          See the LICENSE file for details.            //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

//////////////////////////////////////////////////////////////////////////////////////////
// Fly-Pie has a D-Bus interface which allows not only to open configured menus via the //
// command line, but also to open completely custom-made menus defined with a JSON      //
// string. For a complete description see README.md.                                    //
//////////////////////////////////////////////////////////////////////////////////////////

var DBusInterface = {
  description:
      '<node>                                                                            \
        <interface name="org.gnome.Shell.Extensions.flypie">                             \
          <method name="ShowMenu">                                                       \
            <arg name="name"   type="s" direction="in"/>                                 \
            <arg name="menuID" type="i" direction="out"/>                                \
          </method>                                                                      \
          <method name="ShowMenuAt">                                                     \
            <arg name="name"   type="s" direction="in"/>                                 \
            <arg name="x"      type="i" direction="in"/>                                 \
            <arg name="y"      type="i" direction="in"/>                                 \
            <arg name="menuID" type="i" direction="out"/>                                \
          </method>                                                                      \
          <method name="PreviewMenu">                                                    \
            <arg name="name"   type="s" direction="in"/>                                 \
            <arg name="menuID" type="i" direction="out"/>                                \
          </method>                                                                      \
          <method name="ShowCustomMenu">                                                 \
            <arg name="description" type="s" direction="in"/>                            \
            <arg name="menuID"      type="i" direction="out"/>                           \
          </method>                                                                      \
          <method name="ShowCustomMenuAt">                                               \
            <arg name="description" type="s" direction="in"/>                            \
            <arg name="x"           type="i" direction="in"/>                            \
            <arg name="y"           type="i" direction="in"/>                            \
            <arg name="menuID"      type="i" direction="out"/>                           \
          </method>                                                                      \
          <method name="PreviewCustomMenu">                                              \
            <arg name="description" type="s" direction="in"/>                            \
            <arg name="menuID"      type="i" direction="out"/>                           \
          </method>                                                                      \
          <method name="CancelMenu">                                                     \
            <arg name="result"  type="i" direction="out"/>                               \
          </method>                                                                      \
          <method name="SelectItem">                                                     \
            <arg name="path"    type="s" direction="in"/>                                \
            <arg name="result"  type="i" direction="out"/>                               \
          </method>                                                                      \
          <signal name="OnHover">                                                        \
              <arg name="menuID" type="i"/>                                              \
              <arg name="itemID" type="s"/>                                              \
          </signal>                                                                      \
          <signal name="OnUnhover">                                                      \
              <arg name="menuID" type="i"/>                                              \
              <arg name="itemID" type="s"/>                                              \
          </signal>                                                                      \
          <signal name="OnSelect">                                                       \
              <arg name="menuID" type="i"/>                                              \
              <arg name="itemID" type="s"/>                                              \
          </signal>                                                                      \
          <signal name="OnCancel">                                                       \
              <arg name="menuID" type="i"/>                                              \
          </signal>                                                                      \
      </interface>                                                                       \
    </node>',

  // The Show* and Preview* methods of the D-Bus interface all return a positive menu ID.
  // If a negative number is returned, an error occurred. The possible error values are
  // listed below.
  errorCodes: {
    eUnknownError: -1,
    eInvalidJSON: -2,
    eInvalidMenuConfiguration: -3,
    eInvalidAngles: -4,
    eNoSuchMenu: -5,
    eNoActiveMenu: -6,
    eInvalidPath: -7,
  },

  // This can be used to translate an error code to a human-readable message.
  getErrorDescription: (code) => {
    switch (code) {
      case -2:
        return 'The provided menu description was no valid JSON.';
      case -3:
        return 'The menu configuration was invalid.';
      case -4:
        return 'The angles of the children did not follow the rules.';
      case -5:
        return 'No menu with this name exists.';
      case -6:
        return 'There is currently no menu open.';
      case -7:
        return 'No menu item with this path exists.';
      default:
        return 'An unknown error occurred.';
    }
  }
};