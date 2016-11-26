const chalk = require('chalk');
const ms = require('pretty-ms');
const timeSpan = require('time-span');
const DEFAULT = require('./default');
const MSG = require('./messages');

const TYPE_SHORTCUT = {
  prerelease: 'pre',
  postrelease: 'post'
};

class Animation {
  constructor(params) {
    for (let param in params) { let value = params[param]; this[param] = value; }
    this.isPostRelease = this.type === 'postrelease';
    this.isPreRelease  = this.type === 'prerelease';
  }

  start(cb) {
    this.timespan = timeSpan();
    this.running = true;
    let shortcut = TYPE_SHORTCUT[this.type];
    if (this.isPostRelease) { process.stdout.write('\n'); }

    this.logger.keyword = `${chalk.magenta(shortcut)} ${this.logger.keyword}`;
    this.logger.success(`Starting ${chalk.cyan(this.text)}`);
    return cb();
  }

  stop(err, cb) {
    this.running = false;

    if (err) {
      this.logger.keyword = DEFAULT.logger.keyword;
      return cb(err);
    }

    let end = ms(this.timespan());
    this.logger.success(`Finished ${chalk.cyan(this.text)} after ${chalk.magenta(end)}.`);
    if (this.isPreRelease) { process.stdout.write('\n'); }
    this.logger.keyword = DEFAULT.logger.keyword;
    return cb();
  }
};

Animation.end = (opts) => {
  opts.logger.success(MSG.CREATED_VERSION(opts.version));
  opts.logger.keyword = DEFAULT.logger.keyword;
}

module.exports = Animation;
