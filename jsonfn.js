/**
 * JSONfn - javascript (both node.js and browser) plugin to stringify,
 *          parse and clone objects with Functions, Regexp and Date.
 *
 * Version - 1.1.0
 * Copyright (c) Vadim Kiryukhin
 * vkiryukhin @ gmail.com
 * http://www.eslinstructor.net/jsonfn/
 *
 * Licensed under the MIT license ( http://www.opensource.org/licenses/mit-license.php )
 *
 *   USAGE:
 *     browser:
 *         JSONfn.stringify(obj);
 *         JSONfn.parse(str[, date2obj]);
 *         JSONfn.clone(obj[, date2obj]);
 *
 *     nodejs:
 *       var JSONfn = require('path/to/json-fn');
 *       JSONfn.stringify(obj);
 *       JSONfn.parse(str[, date2obj]);
 *       JSONfn.clone(obj[, date2obj]);
 *
 *
 *     @obj      -  Object;
 *     @str      -  String, which is returned by JSONfn.stringify() function;
 *     @date2obj - Boolean (optional); if true, date string in ISO8061 format
 *                 is converted into a Date object; otherwise, it is left as a String.
 */

(function (exports) {
  'use strict';


  function resolveRequireModules(module) {
    return window ? window[module] : null;
  }

  function resolveExportModules(fn) {
    const module = {
      exports: {}
    };
    try {
      if (typeof window === 'undefined') {
        Function('module', 'exports', fn).call(module.exports, module, module.exports);
      } else {
        Function('module', 'require', 'exports', fn).call(module.exports, module, resolveRequireModules, module.exports);
      }
    } catch (e) {
      console.warn(e)
    }
    return module.exports;
  }

  let codeResolveExtend;

  exports.setCodeResolveExtend = function (fn) {
    codeResolveExtend = fn;
  }
  let handlers = [];
  exports.addHandler = function (testStringify, testParse, stringify, parse) {
    handlers.push({testStringify, testParse, stringify, parse});
  }
  exports.stringify = function (obj, cb) {

    return JSON.stringify(obj, function (key, value) {
      let fnBody;
      if (value === undefined) {
        return '_undefined_';
      } if (value === String) {
        return '_Schema_String';
      } else if (value === Number) {
        return '_Schema_Number';
      } else if (value === Boolean) {
        return '_Schema_Boolean';
      } else if (value === Date) {
        return '_Schema_Date';
      } /* else if (value === Buffer) {
        return '_Schema_Buffer';
      } */ else if (value === Array) {
        return '_Schema_Array';
      } else if (value === Map) {
        return '_Schema_Map';
      }
      for (const handler of handlers) {
        if (handler.testStringify(key, this[key])) {
          return handler.stringify(key, this[key]);
        }
      }
      if (value && value.hasOwnProperty('_code_')) {
        fnBody = { _code_: value['_code_'], _code_type_: value['_code_type_'] || 'commonJs'};
        if (value['_metadata_']) fnBody['_metadata_'] = value['_metadata_'];
        return fnBody;
      } else if (value && (value instanceof Function || typeof value == 'function')) {
        fnBody = value.toString();
        if (fnBody.length < 8 || fnBody.substring(0, 8) !== 'function') { //this is ES6 Arrow Function
          return '_NuFrRa_' + fnBody;
        }
        return fnBody;
      }

      if (value instanceof RegExp) {
        return '_PxEgEr_' + value;
      }
      if (value && value.type === 'Buffer' && value.data) {
        return '_Buffer_' + Buffer.from(value.data).toString('base64');
      }
      if (cb) {
        return cb(key, value);
      }
      return value;
    });
  };

  exports.parse = function (str, date2obj = true, codeSupport, cb) {

    const iso8061 = date2obj ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)Z$/ : false;

    let undefinedArr = [];
    const result = JSON.parse(str, function (key, value) {
      let prefix;

      if (codeSupport) {
        if (typeof value === 'object' && Object.prototype.toString.call(value) === '[object Object]' && value.hasOwnProperty('_code_')) {
          switch (value._code_type_) {
            case 'commonJs':
              if (value._code_ === '') return null;
              const result = resolveExportModules(value._code_);
              Object.defineProperty(result, '_code_', {
                value: value._code_,
                writable: true
              });
              Object.defineProperty(result, '_code_type_', {
                value: value._code_type_,
                writable: true
              });
              Object.defineProperty(result, '_metadata_', {
                value: value._metadata_,
                writable: true
              });
              return result;
          }
          if (codeResolveExtend) {
            const result = codeResolveExtend(value)
            if (result) {
              Object.defineProperty(result, '_code_', {
                value: value._code_,
                writable: true
              });
              Object.defineProperty(result, '_code_type_', {
                value: value._code_type_,
                writable: true
              });
              Object.defineProperty(result, '_metadata_', {
                value: value._metadata_,
                writable: true
              });
              return result;
            }
          }
        }
      }
      if (typeof value != 'string') {
        return value;
      }
      if (value === '_undefined_') {
        undefinedArr.push({obj: this, k: key})
        return undefined;
      }
      if (value.length < 8) {
        return value;
      }
      prefix = value.substring(0, 8);
      if (iso8061 && value.match(iso8061)) {
        return new Date(value);
      }
      if (prefix === 'function') {
        return eval('(' + value + ')');
      }
      if (prefix === '_PxEgEr_') {
        return eval(value.slice(8));
      }
      if (prefix === '_NuFrRa_') {
        return eval(value.slice(8));
      }
      if (prefix === '_Schema_') {
        if (value === '_Schema_String') {
          return String;
        }
        if (value === '_Schema_Number') {
          return Number;
        }
        if (value === '_Schema_Boolean') {
          return Boolean;
        }
        if (value === '_Schema_Date') {
          return Date;
        }
        if (value === '_Schema_Buffer') {
          return Buffer;
        }
        if (value === '_Schema_Array') {
          return Array;
        }
        if (value === '_Schema_Map') {
          return Map;
        }
      }
      if (prefix === '_Buffer_') {
        return Buffer.from(Buffer.from(value.slice(8), 'base64'));
      }
      for (const handler of handlers) {
        if (handler.testParse(key, value)) {
          return handler.parse(key, value);
        }
      }
      if (cb) {
        return cb(key, value);
      }
      return value;
    });
    for (const {k, obj} of undefinedArr) {
      obj[k] = undefined;
    }
    return result;
  };

  exports.clone = function (obj, date2obj, codeSupport) {
    return exports.parse(exports.stringify(obj), date2obj, codeSupport);
  };

}(typeof exports === 'undefined' ? (window.JSONfn = {}) : exports));
