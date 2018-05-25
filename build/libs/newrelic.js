/**
 * author: Thuan Q. Truong (thuantq@soft.com.vn)
 *
 * Script for setting up NewRelic monitoring:
 * - Create user provided service for New Relic with a provided license key
 * - Bind/unbind the New Relic service to the apps.
 * 
 */

var _cmd = require('./cmd'),
  _fs = require('fs'),
  _log = require('./logger')
  ;

module.exports = function (env) {
  var self = this;
  this.newrelicCfg = require('../configs/cf-newrelic-config');
  self.env = env || 'dev';


  this._cmdCreateUserProvidedService = function () {
    _log.ok('Creating user provided service <s> ...'.replace('<s>', self.newrelicCfg.name));
    var c = 'cf service <i> || cf create-user-provided-service <i>'
      .replace(/<i>/g, self.newrelicCfg.name);
    if (self.newrelicCfg.parameters) {
      c += (' -p "' + self._parameters(self.newrelicCfg.parameters) + '"');
    }
    return c;
  };


  this._cmdRestageApp = function (appName) {
    _log.ok('Going to restage application <a> ...'.replace('<a>', appName));
    var c = 'cf restage '+ appName;
    return c;
  };

  this._cmdBindNewRelicService = function (appName) {
    _log.ok('Going to bind New Relic service to app <a> ...'.replace('<a>', appName));
    return 'cf bind-service <a> <s>'
      .replace('<a>', appName)
      .replace('<s>', self.newrelicCfg.name);
  };


    this._cmdUnbindNewRelicService = function (appName) {
    _log.ok('Going to unbind New Relic service to app <a> ...'.replace('<a>', appName));
    return 'cf unbind-service <a> <s>'
      .replace('<a>', appName)
      .replace('<s>', self.newrelicCfg.name);
  };



  this._bindNewRelicService = function(appName) {
     _log.ok("Binding New Relic service to applications");
     if (appName) {
        return _cmd.run(self._cmdBindNewRelicService(appName))
              .then( function() {
                return _cmd.run(self._cmdRestageApp(appName));
              });
     } else {
      var apps = self.newrelicCfg.applications;
          apps.reduce(function (p, app) {
          return p.then(function () {
          return _cmd.run(self._cmdBindNewRelicService(app + "-" + self.env))
              .then( function() {
                return _cmd.run(self._cmdRestageApp(app + "-" + self.env));
              });
          });
      }, Promise.resolve());
      }    
   }   

   this._unbindNewRelicService = function(appName) {
     if (appName) {
        _log.ok("Unbinding New Relic service to application " + appName);
        return _cmd.run(self._cmdUnbindNewRelicService(appName))
              .then( function() {
                return _cmd.run(self._cmdRestageApp(appName));
              });
     } else {
      _log.ok("Unbinding New Relic service to applications");
      var apps = self.newrelicCfg.applications;
          apps.reduce(function (p, app) {
          return p.then(function () {
            appName = app + "-" + self.env;
            return _cmd.run(self._cmdUnbindNewRelicService(appName))
              .then( function() {
                return _cmd.run(self._cmdRestageApp(appName));
              });
          });
      }, Promise.resolve());
      }    
   }   


  this._createNewRelicService = function () {
    return _cmd.run(self._cmdCreateUserProvidedService());
  };

  this._getNewRelicServiceName = function () {
    return self.newrelicCfg.name;
  }

  /**
   * setup
   * @returns {Promise}
   */
  this.enableNewRelicMonitoring = function (appName) {
    return new Promise(function (resolve, reject) {
      self._createNewRelicService()
        .then(self._bindNewRelicService(appName))
        .then(resolve)
        .catch(reject);
    });
  };


    /**
   * setup
   * @returns {Promise}
   */
  this.disableNewRelicMonitoring = function (appName) {
    return new Promise(function (resolve, reject) {
      self._unbindNewRelicService(appName)
        .then(resolve)
        .catch(reject);
    });
  };


  return this;
};
