// port of https://github.com/nodejs/node/blob/v6.0.0/lib/assert.js

// http://wiki.commonjs.org/wiki/Unit_Testing/1.0
//
// Originally from narwhal.js (http://narwhaljs.org)
// Copyright (c) 2009 Thomas Robinson <280north.com>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the 'Software'), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
// ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

var Buffer = require('buffer').Buffer;
var compare = Buffer.compare;
var filter = require('array-filter');
var pSlice = Array.prototype.slice;
var getPrototypeOf = Object.getPrototypeOf || function(obj) {
  return obj.__proto__ || (
    obj.constructor
      ? obj.constructor.prototype
      : Object.prototype
  );
};
function isEnumerable(obj, key) {
  return Object.prototype.propertyIsEnumerable.call(obj, key);
};
function pToString(obj) {
  return Object.prototype.toString.call(obj);
};
function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
function isDate(d) {
  return isObject(d) && pToString(d) === '[object Date]';
}
function isRegExp(re) {
  return isObject(re) && pToString(re) === '[object RegExp]';
}
function isArguments(object) {
  return isObject(object) && pToString(object) == '[object Arguments]';
}
function fromBufferSupport() {
  try {
    return typeof Buffer.from === 'function' && !!Buffer.from([0x62,0x75,0x66,0x66,0x65,0x72]);
  } catch (e) {
    // Buffer.from under Node 4.x causes `TypeError: this is not a typed array.`
    return false;
  }
}
var toBuffer = (function () {
  // check whether Buffer constructor accepts ArrayBuffer or not
  function isBufferConstructorAcceptsArrayBuffer() {
    try {
      return typeof Uint8Array === 'function' && (new Buffer(new Uint8Array([1]).buffer)[0] === 1);
    } catch (e) {
      return false;
    }
  }
  if (isBufferConstructorAcceptsArrayBuffer()) {
    // Node 4.x
    return function (ab) {
      return new Buffer(ab);
    };
  } else {
    // Node 0.10.x and 0.12.x
    return function (ab) {
      var buffer = new Buffer(ab.byteLength);
      var view = new Uint8Array(ab);
      for (var i = 0; i < buffer.length; ++i) {
        buffer[i] = view[i];
      }
      return buffer;
    };
  }
})();
var bufferFrom = fromBufferSupport() ? Buffer.from : toBuffer;
var objectKeys = (function () {
  var OLD_V8_ARRAY_BUFFER_ENUM = ['BYTES_PER_ELEMENT','get','set','slice','subarray','buffer','length','byteOffset','byteLength'];
  var keys = Object.keys || require('object-keys');
  return function objectKeys(obj) {
    // avoid iterating enumerable properties of ArrayBuffer under old V8
    if (isEnumerable(obj, 'buffer') &&
        isEnumerable(obj, 'byteOffset') &&
        isEnumerable(obj, 'byteLength')) {
      return filter(keys(obj), function (k) {
        return OLD_V8_ARRAY_BUFFER_ENUM.indexOf(k) === -1;
      });
    } else {
      return keys(obj);
    }
  };
})();

function _deepEqual(actual, expected, strict) {
  // 7.1. All identical values are equivalent, as determined by ===.
  if (actual === expected) {
    return true;
  } else if (actual instanceof Buffer && expected instanceof Buffer) {
    return compare(actual, expected) === 0;

  // 7.2. If the expected value is a Date object, the actual value is
  // equivalent if it is also a Date object that refers to the same time.
  } else if (isDate(actual) && isDate(expected)) {
    return actual.getTime() === expected.getTime();

  // 7.3 If the expected value is a RegExp object, the actual value is
  // equivalent if it is also a RegExp object with the same source and
  // properties (`global`, `multiline`, `lastIndex`, `ignoreCase`).
  } else if (isRegExp(actual) && isRegExp(expected)) {
    return actual.source === expected.source &&
           actual.global === expected.global &&
           actual.multiline === expected.multiline &&
           actual.lastIndex === expected.lastIndex &&
           actual.ignoreCase === expected.ignoreCase;

  // 7.4. Other pairs that do not both pass typeof value == 'object',
  // equivalence is determined by ==.
  } else if ((actual === null || typeof actual !== 'object') &&
             (expected === null || typeof expected !== 'object')) {
    return strict ? actual === expected : actual == expected;

  // If both values are instances of typed arrays, wrap their underlying
  // ArrayBuffers in a Buffer each to increase performance
  // This optimization requires the arrays to have the same type as checked by
  // Object.prototype.toString (aka pToString). Never perform binary
  // comparisons for Float*Arrays, though, since e.g. +0 === -0 but their
  // bit patterns are not identical.
  } else if (typeof ArrayBuffer === 'function' && typeof ArrayBuffer.isView === 'function' &&
             ArrayBuffer.isView(actual) && ArrayBuffer.isView(expected) &&
             pToString(actual) === pToString(expected) &&
             !(actual instanceof Float32Array ||
               actual instanceof Float64Array)) {
    return compare(bufferFrom(actual.buffer),
                   bufferFrom(expected.buffer)) === 0;

  // 7.5 For all other Object pairs, including Array objects, equivalence is
  // determined by having the same number of owned properties (as verified
  // with Object.prototype.hasOwnProperty.call), the same set of keys
  // (although not necessarily the same order), equivalent values for every
  // corresponding key, and an identical 'prototype' property. Note: this
  // accounts for both named and indexed properties on Arrays.
  } else {
    return objEquiv(actual, expected, strict);
  }
}

function objEquiv(a, b, strict) {
  if (a === null || a === undefined || b === null || b === undefined)
    return false;
  // if one is a primitive, the other must be same
  if (isPrimitive(a) || isPrimitive(b))
    return a === b;
  if (strict && getPrototypeOf(a) !== getPrototypeOf(b))
    return false;
  var aIsArgs = isArguments(a),
      bIsArgs = isArguments(b);
  if ((aIsArgs && !bIsArgs) || (!aIsArgs && bIsArgs))
    return false;
  if (aIsArgs) {
    a = pSlice.call(a);
    b = pSlice.call(b);
    return _deepEqual(a, b, strict);
  }
  var ka = objectKeys(a),
      kb = objectKeys(b),
      key, i;
  // having the same number of owned properties (keys incorporates
  // hasOwnProperty)
  if (ka.length != kb.length)
    return false;
  //the same set of keys (although not necessarily the same order),
  ka.sort();
  kb.sort();
  //~~~cheap key test
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] != kb[i])
      return false;
  }
  //equivalent values for every corresponding key, and
  //~~~possibly expensive deep test
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!_deepEqual(a[key], b[key], strict)) return false;
  }
  return true;
}

module.exports = _deepEqual;
