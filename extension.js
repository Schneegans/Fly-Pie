//////////////////////////////////////////////////////////////////////////////////////////
//   _____       _             _____ _                                                  //
//  |   __|_ _ _|_|___ ___ ___|  _  |_|___   This software may be modified and distri-  //
//  |__   | | | | |   | . |___|   __| | -_|  buted under the terms of the MIT license.  //
//  |_____|_____|_|_|_|_  |   |__|  |_|___|  See the LICENSE file for details.          //
//                    |___|                                                             //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Me     = imports.misc.extensionUtils.getCurrentExtension();
const Server = Me.imports.daemon.Server.Server;
const Client = Me.imports.daemon.Client.Client;

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
