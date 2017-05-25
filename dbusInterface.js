/////////////////////////////////////////////////////////////////////////////////////////
//                                                                                     //
//    _____                    ___  _     ___       This software may be modified      //
//   / ___/__  ___  __ _  ___ / _ \(_)__ |_  |      and distributed under the          //
//  / (_ / _ \/ _ \/  ' \/ -_) ___/ / -_) __/       terms of the MIT license. See      //
//  \___/_//_/\___/_/_/_/\__/_/  /_/\__/____/       the LICENSE file for details.      //
//                                                                                     //
//  Authors: Simon Schneegans (code@simonschneegans.de)                                //
//                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////

const DBusInterface =
  '<node>                                                                               \
    <interface name="org.gnome.Shell.Extensions.GnomePie2">                             \
        <method name="ShowMenu">                                                        \
          <arg name="description" type="s" direction="in"/>                             \
          <arg name="id" type="i" direction="out"/>                                     \
        </method>                                                                       \
        <signal name="OnSelect">                                                        \
            <arg type="i" name="id"/>                                                   \
            <arg type="s" name="item"/>                                                 \
        </signal>                                                                       \
        <signal name="OnCancel">                                                        \
            <arg type="i" name="id"/>                                                   \
        </signal>                                                                       \
    </interface>                                                                        \
  </node>';
