const path = require('path');
const async = require('async');
const semver = require('semver');
const util = require('./util');
const DEFAULT = require('./default');
const MSG = require('./messages');
const Animation = require('./animation');

module.exports = class Semver {
  constructor(bumped) {
    this.sync = this.sync.bind(this);
    this.versions = this.versions.bind(this);
    this.release = this.release.bind(this);
    this.save = this.save.bind(this);
    this.version = this.version.bind(this);
    this.releaseBasedOn = this.releaseBasedOn.bind(this);
    this._releaseBasedOnNatureSemver = this._releaseBasedOnNatureSemver.bind(this);
    this._releasesBasedOnSemver = this._releasesBasedOnSemver.bind(this);
    this._releasesBasedOnVersion = this._releasesBasedOnVersion.bind(this);

    this.bumped = bumped;
  }

  /**
   * Get the high project version across config files declared.
   * @return {[type]} [description]
  */
  sync() {
    const [opts, cb] = DEFAULT.args(arguments);
    async.compose(this.max, this.versions)((err, max) => {
      this.bumped._version = max;

      cb();
    });
  }

  versions(cb) {
    async.reduce(this.bumped.config.rc.files, [], (accumulator, file, next) => {
      const { version } = require(path.resolve(file));
      if (version) { accumulator.push(version); }

      next(null, accumulator);
    }, cb);
  }

  max(versions, cb) {
    const initial = versions.shift();
    async.reduce(versions, initial, (max, version, next) => {
      if (semver.gt(version, max)) { max = version; }
      next(null, max);
    }, cb);
  }

  release() {
    const [opts, cb] = DEFAULT.args(arguments);
    if (!opts.version) { return this.bumped.logger.errorHandler(MSG.NOT_VALID_VERSION(opts.version), cb); }

    if (this.bumped._version == null) { this.bumped._version = '0.0.0'; }
    const semverStyle = this.detect(opts.version);
    const releaseVersion = this.releaseBasedOn(semverStyle);

    const tasks = [
      next => {
        opts.type = 'prerelease';
        return this.bumped.plugin.exec(opts, next);
      },
      next =>
        releaseVersion({
          version: opts.version,
          prefix: opts.prefix
        }
        , next)
      ,
      (newVersion, next) => {
        this.bumped._oldVersion = this.bumped._version;
        return this.update({version: newVersion}, next);
      },
      next => {
        opts.type = 'postrelease';
        return this.bumped.plugin.exec(opts, next);
      }
    ];

    return async.waterfall(tasks, err => {
      if (err) { return this.bumped.logger.errorHandler(err, cb); }
      return cb(null, this.bumped._version);
    }
    );
  }

  update() {
    let [opts, cb] = DEFAULT.args(arguments);

    this.bumped._version = opts.version;

    return async.forEachOf(this.bumped.config.rc.files, this.save, err => {
      if (err) { return this.bumped.logger.errorHandler(err, cb); }

      Animation.end({
        logger   : this.bumped.logger,
        version  : this.bumped._version
      });

      return cb();
    }
    );
  }

  save(file, index, cb) {
    return util.updateJSON({
      filename : file,
      property : 'version',
      value    : this.bumped._version,
      force    : index === 0
    }
    , cb);
  }

  /**
   * Print the current synchronized version.
  */
  version() {
    let [opts, cb] = DEFAULT.args(arguments);

    if (this.bumped._version != null) {
      this.bumped.logger.success(MSG.CURRENT_VERSION(this.bumped._version));
    } else {
      this.bumped.logger.errorHandler(MSG.NOT_CURRENT_VERSION(), {lineBreak:false});
    }

    return cb(this.bumped._version);
  }

  detect(word) {
    if (util.includes(DEFAULT.keywords.semver, word)) { return 'semver'; }
    if (util.includes(DEFAULT.keywords.nature, word)) { return 'nature'; }
    return 'numeric';
  }

  releaseBasedOn(type) {
    if (type === 'semver') { return this._releasesBasedOnSemver; }
    if (type === 'nature') { return this._releaseBasedOnNatureSemver; }
    return this._releasesBasedOnVersion;
  }

  _releaseBasedOnNatureSemver(opts, cb) {
    return cb(null, semver.inc(this.bumped._version, DEFAULT.keywords.adapter[opts.version]));
  }

  _releasesBasedOnSemver(opts, cb) {
    return cb(null, semver.inc(this.bumped._version, opts.version, opts.prefix));
  }

  _releasesBasedOnVersion(opts, cb) {
    let version = semver.clean(opts.version);
    version = semver.valid(version);
    if (version == null) { return cb(MSG.NOT_VALID_VERSION(version)); }
    if (!semver.gt(version, this.bumped._version)) { return cb(MSG.NOT_GREATER_VERSION(version, this.bumped._version)); }
    return cb(null, version);
  }
};
