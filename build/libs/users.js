/**
 * author: Thuan Q Truong (thuantq@fsoft.com.vn)
 *
 * This is the scipt to setup UAA client and users either by using uaac or UAA rest services depend on the flag --use-uaac
 */

var _cmd = require('./cmd'),
  _log = require('./logger')
  ;

module.exports = function (options) {
  var self = this;
  this.options = options || {};
 // this.dummyAppName = 'dummy-app-' + options.env;
  this.dummyAppName = 'data-app-' + options.env;
  this.uaaUri = "";
  this.adminToken = "";
  this.clientToken = "";
  this.cfAdminSecret = this.options.cfAdminSecret
  _log.ok(this.options.useUaac === true);

  _usr = this.options.useUaac === true ? require('./usersuaac') : require('./usershttp');
  var userprocessor = _usr(options);

  this._parseVcap = function (_, appName) {
    appName = appName || self.dummyAppName;
    _log.ok('Parsing VCAP for app <a> ...'.replace('<a>', appName));
    return new Promise(function (resolve, reject) {
      _cmd.run('cf e ' + (appName))
        .then(function (data) {
          data = data.stdout.replace(/\n/g, '').replace(/ /g, '');
          if (appName === self.dummyAppName) {
            self.options.vcapServices = JSON.parse(data.split('{"VCAP_SERVICES":')[1].split('}{"VCAP_APPLICATION":')[0]);
          }
          self.options.vcapApplications[appName] = JSON.parse(data.split('{"VCAP_APPLICATION":')[1].split('}User')[0].split('}Nouser')[0]);
        })
        .then(resolve)
        .catch(reject);
    });
  };

 this.collectZones = function () {
    _log.ok('Collecting zones of services ...');
    return new Promise(function (resolve, reject) {
      try {
        self.options.services.filter(function (e) {
          return e.zones && e.zones !== {};
        }).forEach(function (service) {
          var zoneTpl = '<p>.<i>.<s>';
          service.zones.suffix.forEach(function (s) {
            var zone = zoneTpl
              .replace('<p>', service.zones.prefix)
              .replace('<i>', self._parseParameter(service.zones.instanceId))
              .replace('<s>', s);
            self.options.users.zones.push(zone);
          });
        });
        resolve(self.zones);
      } catch (e) {
        reject(e);
      }
    });
  };
  

  this.setupUaaClientUser = function () {
    _log.ok("Setting up client ....");
    return new Promise(function (resolve, reject) {
      self._parseVcap()
        .then(userprocessor._setupUaaClientUser)
        .then(resolve)
        .catch(reject);
    });
  };

  this.uaacUpdateClient = function () {
    return userprocessor._uaacUpdateClient();
  };

  this.setupUaaZones = function () {
    _log.ok('Setting up UAA zones ...');
    return userprocessor._setupUaaZones();
  };

  return this;
};
