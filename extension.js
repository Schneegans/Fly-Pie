//////////////////////////////////////////////////////////////////////////////////////////
//                                                                                      //
//       ___                       __               This software may be modified       //
//      (_  `     o  _   _        )_) o  _          and distributed under the           //
//    .___) )_)_) ( ) ) (_(  --  /    ) (/_         terms of the MIT license. See       //
//                        _)                        the LICENSE file for details.       //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Me     = imports.misc.extensionUtils.getCurrentExtension();
const Server = Me.imports.server.Server.Server;
const Client = Me.imports.client.Client.Client;

//////////////////////////////////////////////////////////////////////////////////////////
//                                                                                      //
//                    .-----------.           This extension consists of two major      //
//                    | Server.js |           parts: A server and a client. The server  //
//                    '-----------'           listens on the DBus for incoming Show-    //
//                        |                   Menu requests. These can be issued        //
//   .-----------------------------------.    either by the client or by any other      //
//   |     DBus (DBusInterface.js)       |    application. The client registers key     //
//   '-----------------------------------'    bindings and issues Show-Menu requests    //
//             |                   |          over the DBus when the keys are pressed.  //
//   .--------------------.  .-----------.                                              //
//   | Other Applications |  | Client.js |                                              //
//   '--------------------'  '-----------'                                              //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

let server, client;

// This function is called once when the extension is loaded, not enabled.
function init() {}

// This function could be called after the extension is enabled, which could be done from
// GNOME Tweaks, when you log in or when the screen is unlocked.
function enable() {
  server = new Server();
  client = new Client();
}

// This function could be called after the extension is uninstalled, disabled in GNOME
// Tweaks, when you log out or when the screen locks.
function disable() {
  server.destroy();
  client.destroy();

  server = null;
  client = null;
}
