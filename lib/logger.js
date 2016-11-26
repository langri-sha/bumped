const Acho = require('acho');
const DEFAULT = require('./default');
const MSG = require('./messages');
const { noop } = require('./util');
const { isArray } = require('./util');
const { isBoolean } = require('./util');

const optsDefault = {
  lineBreak: true,
  output: true
};

/**
 * Unify error logging endpoint
 * @param  {Message}   err Error structure based on Message.
 * @param  {Object}   opts Configurable options
 * @param  {Object}   [opts.lineBreak=true] Prints Line break
 * @param  {Function} cb   [description]
 */
function errorHandler (err, opts, cb) {
  if (arguments.length === 2 && typeof arguments[1] === 'function') {
    cb = opts;
    opts = optsDefault;
  } else {
    opts = Object.assign(optsDefault, opts);
    if (!cb) { cb = noop; }
  }

  if (this.level === 'silent' || !opts.output) { return cb(err); }

  if (isBoolean(err)) { err = MSG.NOT_PROPERLY_FINISHED(err); }
  const printErrorMessage = err => this.error(err.message || err);
  if (opts.lineBreak) { process.stdout.write('\n'); }
  if (!isArray(err)) { err = [err]; }

  err.forEach(printErrorMessage);
  cb(err);
};

module.exports = function (opts) {
  opts = Object.assign(DEFAULT.logger, opts);
  const logger = Acho(opts);
  logger.errorHandler = errorHandler;
  // XXX: Check how logger is created and assigned
  return logger;
};
