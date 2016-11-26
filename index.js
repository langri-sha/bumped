const async = require('async');
const Semver = require('./lib/semver');
const Config = require('./lib/config');
const Logger = require('./lib/logger');
const Plugin = require('./lib/plugin');
const DEFAULT = require('./lib/default');
const MSG = require('./lib/messages');

module.exports = class Bumped {
  constructor(opts = {}) {
    this.init = this.init.bind(this);

    if (opts.cwd) { process.chdir(opts.cwd); }
    this.pkg = require('../package.json');
    this.config = new Config(this);
    this.semver = new Semver(this);
    this.logger = new Logger(opts.logger);
    this.plugin = new Plugin(this);
  }

  /**
   * Load a previously cofinguration file declared.
   */
  load() {
    let [opts, cb] = DEFAULT.args(arguments);

    if (!this.config.rc.config) { return cb(); }

    let tasks = [
      next => this.config.load(opts, next),
      next => this.semver.sync(opts, next)
    ];

    async.series(tasks, cb);
  }

  /**
   * Initialize a new configuration file in the current path.
  */
  init() {
    let [opts, cb] = DEFAULT.args(arguments);

    let tasks = [
      next => this.config.autodetect(opts, next),
      next => this.config.save(opts, next),
      next => this.semver.sync(opts, next)
    ];

    async.waterfall(tasks, (err, result) => {
      if (err) { return this.logger.errorHandler(err, cb); }

      this.end(opts, cb);
    });
  }

  end() {
    let [opts, cb] = DEFAULT.args(arguments);

    return this.semver.version(opts, () => {
      this.logger.success(MSG.CONFIG_CREATED());

      cb();
    });
  }
};
