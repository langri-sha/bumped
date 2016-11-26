const rc = require('rc');
const async = require('async');
const fs = require('fs-extra');
const dotProp = require('dot-prop');
const jsonFuture = require('json-future');
const parser = require('parse-config-file');
const parserAsync = async.asyncify(parser);
const { safeDump: serializer } = require('yaml-parser');

module.exports = {
  createJSON(opts, cb){
    jsonFuture.saveAsync(opts.file, opts.data, err => cb(err));
  },

  /**
   * A sweet way to update JSON Arrays, Objects or String from String.
   * @param  {Object}   opts [description]
   * @param  {Function} cb   Standard NodeJS callback.
   * @return {[type]}        Standard NodeJS callback.
  */
  updateJSON(opts, cb) {
    jsonFuture.loadAsync(opts.filename, function(err, file) {
      if (err) { return cb(err); }

      let firstChar = opts.value.charAt(0);
      let lastChar = opts.value.charAt(opts.value.length - 1);
      let isArray = (firstChar === '[') && (lastChar === ']');
      let isDotProp = opts.property.split('.').length > 1;

      if (isArray) {
        let items = opts.value.substring(1, opts.value.length - 1);
        items = items.split(',');
        items = items.map(item => item.trim());
        file[opts.property] = items;
      } else if (isDotProp) {
        dotProp.set(file, opts.property, opts.value);
      } else {
        if ((file[opts.property] != null) || opts.force) { file[opts.property] = opts.value; }
      }

      return jsonFuture.saveAsync(opts.filename, file, cb);
    });
  },

  initConfig(opts) {
    return rc(opts.appname, opts.default, null, parser);
  },

  loadConfig(opts, cb) {
    let tasks = [
      next => fs.readFile(opts.path, {encoding:'utf8'}, next),
      parserAsync
    ];

    return async.waterfall(tasks, cb);
  },

  saveConfig(opts, cb) {
    let data = serializer(opts.data);
    return fs.writeFile(opts.path, data, {encoding: 'utf8'}, cb);
  },

  isBoolean(n) {
    return typeof n === 'boolean';
  },

  isArray: Array.isArray,

  isEmpty(arr) {
    return arr.length === 0;
  },

  includes(arr, word) {
    return arr.indexOf(word) !== -1;
  },

  noop() {},

  size(arr) {
    if (!arr) { return 0; }
    return arr.length;
  }
};
