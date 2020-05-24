//////////////////////////////////////////////////////////////////////////////////////////
//                                                                                      //
//    _____                    ___  _     ___       This software may be modified       //
//   / ___/__  ___  __ _  ___ / _ \(_)__ |_  |      and distributed under the           //
//  / (_ / _ \/ _ \/  ' \/ -_) ___/ / -_) __/       terms of the MIT license. See       //
//  \___/_//_/\___/_/_/_/\__/_/  /_/\__/____/       the LICENSE file for details.       //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const Me = imports.misc.extensionUtils.getCurrentExtension();

//////////////////////////////////////////////////////////////////////////////////////////
// This method can be used to write a message to Gnome-Shell's log. This is enhances    //
// the standard log() functionality by prepending the extensions name and the location  //
// where the message was logged. As the extensions name is part of the location, you    //
// can more effectively watch the log output of Gnome-Shell:                            //
// journalctl /usr/bin/gnome-shell -f -o cat | grep gnomepie -B 2 -A 2                  //
//////////////////////////////////////////////////////////////////////////////////////////

function debug(message) {
  let stack = new Error().stack.split('\n');

  // Remove superfluous function calls on stack.
  stack.shift();
  stack.shift();

  // Find the index of the extension directory (e.g. gnomepie2@code.simonschneegans.de) in
  // the stack entry. We do not want to print the entire absolute file path.
  let extensionRoot = stack[0].indexOf(Me.metadata.uuid);

  log('[' + stack[0].slice(extensionRoot) + '] ' + message);
}

function logProperties(object) {
  for (let element in object) {
    debug(`${element} [${typeof (object[element])}]`);
  }
}