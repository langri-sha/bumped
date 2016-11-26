const path = require('path');
const omit = require('lodash.omit');
const async = require('async');
const resolveUp = require('resolve-up');
const globalNpmPath = require('global-modules');
const updateNotifier = require('update-notifier');
const clone = require('lodash.clonedeep');
const MSG = require('./messages');
const Animation = require('./animation');
const { isEmpty } = require('./util');
const { spawnSync } = require('child_process');

let npmInstallGlobal = pkg =>
  spawnSync('npm', [ 'install', pkg ], {
    stdio: 'inherit',
    cwd: globalNpmPath
  }
  )
;

/**
 * Bumped.plugin
 *
 * Module to call each plugin declared for the user in the configuration file.
 * Modules follow a duck type interface and are sorted.
 * If any plugin throw and error, automatically stop the rest of the plugins.
*/
module.exports = class Plugin {
  constructor(bumped) {
    this.bumped = bumped;
    this.prerelease = this.bumped.config.rc.plugins.prerelease;
    this.postrelease = this.bumped.config.rc.plugins.postrelease;
    this.cache = {};
  }

  pluginPath(plugin) {
    const pluginPath = resolveUp(plugin);
    if (pluginPath.length > 0) { return pluginPath[0]; }
    this.bumped.logger.warn(MSG.INSTALLING_PLUGIN(plugin));
    this.bumped.logger.warn(MSG.INSTALLING_PLUGIN_2());
    npmInstallGlobal(plugin);
    return path.resolve(globalNpmPath, plugin);
  }

  buildOptions(opts) {
    return {
      opts: omit(opts, 'plugin'),
      title: opts.plugin,
      logger: this.bumped.logger,
      path: this.pluginPath(opts.plugin)
    };
  }

  exec(opts, cb) {
    const pluginType = this[opts.type];
    if (isEmpty(Object.keys(pluginType))) { return cb(null); }

    async.forEachOfSeries(pluginType, (settings, description, next) => {
      const pluginOptions = this.buildOptions(settings);
      let plugin;

      if (this.cache[settings.plugin]) {
        plugin = this.cache[settings.plugin];
      } else {
        plugin = this.cache[settings.plugin] = require(pluginOptions.path);
        this.notifyPlugin(pluginOptions.path);
      }

      let animation = new Animation({
        text   : description,
        logger : this.bumped.logger,
        plugin : settings.plugin,
        type   : opts.type
      });

      animation.start(() => {
        plugin(this.bumped, pluginOptions, err => animation.stop(err, next));
      });
    }, cb);
  }

  notifyPlugin(pluginPath) {
    const pkgPath = path.join(pluginPath, 'package.json');
    // XXX: return necessary?
    return updateNotifier({pkg: require(pkgPath)}).notify();
  }
};
