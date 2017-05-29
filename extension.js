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

const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();

const Server = Me.imports.server.Server;
const Client = Me.imports.client.Client;

/////////////////////////////////////////////////////////////////////////////////////////
//                                                                                     //
//                    .-----------.           This extension consists of two major     //
//                    | server.js |           parts: A server and a client. The server //
//                    '-----------'           listens on the DBus for incoming Menu-   //
//                        |                   Toggle requests. These can be issued     //
//   .-----------------------------------.    either by the client or by any other     //
//   |     DBUS (dbusInterface.js)       |    application. The client registers key    //
//   '-----------------------------------'    bindings and issues Menu-Toggle requests //
//             |                   |                          over the DBus when the   //
//   .-------------------.   .-----------.      .---------.   keys are pressed. The    //
//   | Other Application |   | client.js | --- | prefs.js |   keys can be configured   //
//   '-------------------'   '-----------'     '----------'   via the preferences.     //
//                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////

let server, client;

function init() {}

function enable() {
  server = new Server(); 
  client = new Client();
}

function disable() { 
  server.destroy();
  client.destroy();
};
