//////////////////////////////////////////////////////////////////////////////////////////
//                                                                                      //
//    _____                    ___  _     ___       This software may be modified       //
//   / ___/__  ___  __ _  ___ / _ \(_)__ |_  |      and distributed under the           //
//  / (_ / _ \/ _ \/  ' \/ -_) ___/ / -_) __/       terms of the MIT license. See       //
//  \___/_//_/\___/_/_/_/\__/_/  /_/\__/____/       the LICENSE file for details.       //
//                                                                                      //
//  Authors: Simon Schneegans (code@simonschneegans.de)                                 //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

const Me = imports.misc.extensionUtils.getCurrentExtension();

// code taken from the desk-changer extemsion (https://github.com/BigE/desk-changer/)
function debug(message) {
  let caller = getCaller();
  let output = '[' + Me.metadata.uuid + '/' + caller.split('/').pop() + '] ' + message
  log(output);
}

// Implemented the two functions below using tweaked code from:
// http://stackoverflow.com/a/13227808
function getCaller() {
  let stack = getStack();

  // Remove superfluous function calls on stack
  stack.shift(); // getCaller --> getStack
  stack.shift(); // debug --> getCaller

  // Return caller's caller
  return stack[0];
}

function getStack() {
  // Save original Error.prepareStackTrace
  let origPrepareStackTrace = Error.prepareStackTrace;

  // Override with function that just returns `stack`
  Error.prepareStackTrace = function (_, stack) {
    return stack;
  };

  // Create a new `Error`, which automatically gets `stack`
  let err = new Error();

  // Evaluate `err.stack`, which calls our new `Error.prepareStackTrace`
  let stack = err.stack.split('\n');

  // Restore original `Error.prepareStackTrace`
  Error.prepareStackTrace = origPrepareStackTrace;

  // Remove superfluous function call on stack
  stack.shift(); // getStack --> Error

  return stack
}
