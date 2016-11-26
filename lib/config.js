const path = require('path');
const async = require('async');
const fs = require('fs-extra');
const existsFile = require('exists-file');
const jsonFuture = require('json-future');
const util = require('./util');
const DEFAULT = require('./default');
const MSG = require('./messages');

module.exports = class Config {
  constructor(bumped) {
    this.init = this.init.bind(this);
    this.add = this.add.bind(this);
    this.remove = this.remove.bind(this);
    this.save = this.save.bind(this);
    this.load = this.load.bind(this);
    this.set = this.set.bind(this);

    this.bumped = bumped;
    this.init();
  }

  init(files) {
    this.rc = util.initConfig({
      appname: this.bumped.pkg.name,
      default: DEFAULT.scaffold()
    });
  }

  /**
   * Special '.add' action that try to autodetect common configuration files
   * It doesn't print a error message if the file are not present
   * in the directory.
  */
  autodetect() {
    const [opts, cb] = DEFAULT.args(arguments);

    const tasks = {
      removePreviousConfigFile (next) {
        if (!this.rc.config) { return next(); }

        fs.remove(this.rc.config, err => {
          if (err) { return next(err); }
          this.init();
          next();
        });
      },
      detectCommonFiles (next) {
        async.each(DEFAULT.detectFileNames, (file, done) => {
          this.add({file, output:false}, err => done());
        }, next);
      },
      fallbackUnderNotDetect (next) {
        if (this.rc.files.length !== 0) { return next(); }
        this.addFallback(next);
      },
      generateDefaultPlugins (next) {
        this.rc.plugins = DEFAULT.plugins(this.rc.files);
        next();
      }
    };

    async.waterfall(tasks, cb);
  }

  /**
   * Special '.add' action to be called when autodetect fails.
  */
  addFallback(cb) {
    const opts = {
      file: DEFAULT.fallbackFileName,
      data: {
        version:'0.0.0'
      }
    };

    const tasks = {
      createFallbackFile (next) { util.createJSON(opts, next) },
      addFallbackFile (next) { this.addFile(opts, next) }
    };

    async.waterfall(tasks, cb);
  }

  /**
   * Add a file into configuration file.
   * Before do it, check:
   *  - The file was previously added.
   *  - The file that are you trying to add exists.
  */
  add() {
    const [opts, cb] = DEFAULT.args(arguments);

    const loggerOptions = {
      lineBreak: false,
      output: opts.output
    };

    if (this.hasFile(opts.file)) {
      const message = MSG.NOT_ALREADY_ADD_FILE(opts.file);
      return this.bumped.logger.errorHandler(message, loggerOptions, cb);
    }

    const tasks = [
      next => {
        this.detect(opts, next);
      },
      (exists, next) => {
        if (exists) { return this.addFile(opts, next); }
        const message = MSG.NOT_ADD_FILE(opts.file);
        this.bumped.logger.errorHandler(message, loggerOptions, cb);
      },
      next => {
        if (!opts.save) { return next(); }
        return this.save(opts, next);
      }
    ];

    async.waterfall(tasks, (err, result) => {
      cb(err, this.rc.files);
    });
  }

  /**
   * Detect if a configuration file exists in the project path.
  */
  detect() {
    const [opts, cb] = DEFAULT.args(arguments);

    const filePath = path.join(process.cwd(), opts.file);
    existsFile(filePath, cb);
  }

  remove() {
    let [opts, cb] = DEFAULT.args(arguments);

    if (!this.hasFile(opts.file)) {
      const message = MSG.NOT_REMOVE_FILE(opts.file);
      return this.bumped.logger.errorHandler(message, {lineBreak:false}, cb);
    }

    const tasks = [
      next => this.removeFile(opts, next),
      next => opts.save ? next() : this.save(opts, next)
    ];

    async.waterfall(tasks, (err, result) => {
      cb(err, this.rc.files);
    });
  }

  /**
   * Write from memory to config file.
  */
  save() {
    const [opts, cb] = DEFAULT.args(arguments);

    util.saveConfig({
      path : `.${this.bumped.pkg.name}rc`,
      data : {
        files: this.rc.files,
        plugins: this.rc.plugins
      }
    }, cb);
  }

  load() {
    const [opts, cb] = DEFAULT.args(arguments);

    util.loadConfig({path: this.bumped.config.rc.config} , (err, filedata) => {
      // XXX: Fix thrown error
      if (err) { throw err; }
      this.loadScaffold(filedata);
      return cb();
    } );
  }

  addFile() {
    const [opts, cb] = DEFAULT.args(arguments);

    this.rc.files.push(opts.file);
    this.bumped.logger.success(MSG.ADD_FILE(opts.file));
    cb();
  }

  removeFile() {
    const [opts, cb] = DEFAULT.args(arguments);

    const index = this.rc.files.indexOf(opts.file);
    this.rc.files.splice(index, 1);
    this.bumped.logger.success(MSG.REMOVE_FILE(opts.file));
    cb();
  }

  set() {
    const [opts, cb] = DEFAULT.args(arguments);

    const setProperty = (file, done) => util.updateJSON({
      filename: file,
      property: opts.property,
      value: opts.value,
      force: true
    }, done);

    let message;

    if (util.size(opts.value) === 0) { message = MSG.NOT_SET_PROPERTY(); }
    if (util.size(opts.property) === 0) { message = MSG.NOT_SET_PROPERTY(); }
    if (opts.property === 'version') { message = MSG.NOT_SET_VERSION(); }
    if (message) { return this.bumped.logger.errorHandler(message, {lineBreak:false}, cb); }

    async.each(this.bumped.config.rc.files, setProperty, err => {
      if (err) { return this.bumped.logger.errorHandler(err, cb); }
      this.bumped.logger.success(MSG.SET_PROPERTY(opts.property, opts.value));
      cb(null, opts);
    });
  }

  hasFile(file) {
    return this.rc.files.indexOf(file) !== -1;
  }

  loadScaffold(filedata) {
    this.bumped.config.rc.files = filedata.files;
    this.bumped.config.rc.plugins = filedata.plugins;
  }
};
