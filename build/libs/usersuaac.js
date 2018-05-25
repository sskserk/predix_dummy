/**
 * author: Anh V. Nguyen (anhnv16@fsoft.com.vn)
 * updated by: Thuan Q Truong (thuantq@fsoft.com.vn)
 *
 * This is the scipt to setup UAA client and users by using UAA rest services.
 */

var _cmd = require('./cmd'),
  _fs = require('fs'),
  _log = require('./logger')
  ;

module.exports = function (options) {
  var self = this;
  this.options = options || {};
  self.zones = this.options.users.zones;
  this._uaacTarget = function () {
    var isWin = /^win/.test(process.platform)
    var cmdStr = isWin ? 'uaac target --skip-ssl-validation ' : 'uaac target ';
    return _cmd.run(cmdStr + self.options.vcapServices['predix-uaa'][0].credentials.uri);
  };

  this._uaacGetAdminToken = function () {
    return _cmd.run('uaac token client get admin -s ' + self.options.cfAdminSecret, {shhh: true});
  };

  this._uaacAddClient = function () {
    var cmd = 'uaac client get <c> || uaac client add <c> \
    --name <c> \
    --authorities "uaa.resource" \
    --scope "openid" \
    --autoapprove "openid" \
    --redirect_uri "http://localhost:5000" \
    --authorized_grant_types refresh_token,password,client_credentials,authorization_code \
    -s <p>'.replace(/<c>/g, self.options.uaaClientId || 'predix_client').replace(/<p>/g, self.options.uaaClientPassword || 'Pr3@1X2018');
    return _cmd.run(cmd, {shhh: true});
  };

  this._uaacUpdateClient = function () {
    var cmd = 'uaac client update <c> --scope openid,scim.me,<s> --authorities openid,scim.me,<s> --autoapprove openid,scim.me,<s>'
      .replace('<c>', self.options.uaaClientId || 'predix_client').replace(/<s>/g, self.zones.join(','));
    return _cmd.run(cmd, {shhh: true});
  };

  this._uaacAddUsers = function () {
        cmds = []
        self.options.users.users.map(function(u) {
            cmds.push(
              'uaac user get <u> || uaac user add <u> --emails <m>@ge.com --password <p>'
              .replace(/<u>/g, u.userName)
              .replace(/<p>/g, u.password)
              .replace(/<m>/g, u.emails[0].value)
              );
        })
    return Promise.all(cmds.map(function (c) {
        return _cmd.run(c, {shhh: true});
      }));
  };

  this._setupUaaClientUser = function () {
    return new Promise(function (resolve, reject) {
      self._uaacTarget()
        .then(self._uaacGetAdminToken)
        .then(self._uaacAddClient)
        .then(self._uaacAddUsers)
        .then(resolve)
        .catch(reject);
    });
  };

  this._uaacAddGroups = function () {
    return Promise.all(self.zones.map(function (z) {
      return _cmd.run('uaac group get <g> || uaac group add <g>'.replace(/<g>/g, z));
    }));
  };

  this._uaacAddMembers = function () {
    var cmds = [];
    self.options.users.users.map(function(u) {
      self.zones.forEach(function (z) {
        cmds.push('uaac member add <z> <u>'.replace('<z>', z).replace('<u>', u.userName));
      });
    })  

    return cmds.reduce(function (p, c) {
      return p.then(function () {
        return _cmd.run(c, {allowFailure:true});
      });
    }, Promise.resolve());
  };

  this._setupUaaZones = function () {
    _log.ok('Setting up UAA zones ...');
    return new Promise(function (resolve, reject) {
      self._uaacAddGroups()
        .then(self._uaacAddMembers)
        .then(resolve)
        .catch(reject);
    });
  };

  return this;
};
