/**
 * author: Thuan Q Truong (thuantq@fsoft.com.vn)
 *
 * This is the scipt to setup UAA client and users by using UAA rest services.
 */

var _cmd = require('./cmd'),
  _yml = require('js-yaml'),
  _fs = require('fs'),
  _log = require('./logger'),
  _requert = require('request')
  ;

module.exports = function (options) {
  var self = this;
  this.options = options || {};
  //this.dummyAppName = 'dummy-app-' + options.env;
  this.dummyAppBName = 'data-app-' + options.env;
  this.uaaUri = "";
  this.adminToken = "";
  this.cfAdminSecret = this.options.cfAdminSecret
  this.userIds = [];
  this.groupIds = [];

  
  

this._setupUaaClientUser = function () {
    return new Promise(function (resolve, reject) {
      self._uaacGetAdminToken()
        .then(self._uaacAddClient)
        .then(self._uaacAddUsers)
        .then(resolve)
        .catch(reject);
    });
  };


  this._uaacAddClient = function () {

    return new Promise(function (resolve, reject) {
      _log.ok("Creating UAA client...")
      var uaaUri = self.options.vcapServices['predix-uaa'][0].credentials.uri + '/oauth/clients';
      var headers = {
        'content-type': 'application/json',
        'accept': 'application/json;charset=utf-8',
        'authorization': 'Bearer ' + self.adminToken
      };
     
      var options = {
        url: uaaUri,
        headers: headers,
        body: JSON.stringify(self.options.users.client)
      };
      _requert.post(options, function (err, res, body) {
        if (err) return reject(err);
        if (res.statusCode >= 200 && res.statusCode < 400) {
          return resolve(JSON.parse(body));
        }
        return reject(body);
      });
    });
  };

  this._uaacUpdateClient = function () {
      return new Promise(function (resolve, reject) {
      _log.ok("Update UAA client...")
      var client = self.options.users.client;
      var uaaUri = self.options.vcapServices['predix-uaa'][0].credentials.uri + '/oauth/clients/' + client.client_id;
      var headers = {
        'content-type': 'application/json',
        'accept': 'application/json;charset=utf-8',
        'authorization': 'Bearer ' + self.adminToken
      };
      client.scope.push("scim.me");
      client.authorities.push("scim.me");
      client.authorities.push("openid");
      client.autoapprove.push("scim.me");
      self.options.users.zones.forEach(function(e) {
          client.authorities.push(e);
          client.scope.push(e);
          client.autoapprove.push(e);
      })

      data = {
        scope: client.scope,
        client_id: client.client_id,
        autoapprove: client.autoapprove,
        authorities: client.authorities
      }
      var options = {
        url: uaaUri,
        headers: headers,
        body: JSON.stringify(data)
      };
      _requert.put(options, function (err, res, body) {
        if (err) return reject(err);
        if (res.statusCode >= 200 && res.statusCode < 400) {
          return resolve();
        }
        return reject(body);
      });
    });
  };

  this._uaacAddUsers = function () {
    return Promise.all(
        self.options.users.users.map(function(u) {
            return self._addUser(u);
        })
    );
  };

  this._addUser = function(user) {
      return new Promise(function (resolve, reject) {
      _log.ok("Creating user <u>...".replace("<u>", user.userName));
      var uaaUri = self.options.vcapServices['predix-uaa'][0].credentials.uri + '/Users';
      var headers = {
        'content-type': 'application/json',
        'authorization': 'Bearer ' + self.adminToken
      };
      var options = {
        url: uaaUri,
        headers: headers,
        json: user
      };
      _requert.post(options, function (err, res, body) {
        
        if (err) return reject(err);
        if (res.statusCode >= 200 && res.statusCode < 400) {
          self.userIds.push(body.id);
          return resolve(body.id);
        }
        return reject(JSON.stringify(body, null,2));
      });
    });
  }

  this._uaacAddGroups = function () {
    return Promise.all(self.options.users.zones.map(function (z) {
      return this._addGroup(z);
    }));
  };

this._addGroup = function (zone) {
    return new Promise(function (resolve, reject) {
      _log.ok("Creating group <g>...".replace("<g>", zone));
      var uaaUri = self.options.vcapServices['predix-uaa'][0].credentials.uri + '/Groups';
      var headers = {
        'content-type': 'application/json',
        'authorization': 'Bearer ' + self.adminToken
      };
      var group = {
        displayName: zone
      }
      var options = {
        url: uaaUri,
        headers: headers,
        json: group
      };
      _requert.post(options, function (err, res, body) {
        if (err) return reject(err);
        if (res.statusCode >= 200 && res.statusCode < 400) {
          self.groupIds[zone] = body.id;
          return resolve(body.id);
        }
        return reject(JSON.stringify(body, null,2));
      });
    });
  };

  this._uaacAddMembers = function () {
    _log.ok("Adding members to groups");
    promises = [];
    for (g in self.groupIds) {
          promises.push(self._addMember(g, self.groupIds[g]));
    };

    return Promise.all(promises);
  };

  this._addMember = function(groupName, groupId) {
      return new Promise(function (resolve, reject) {
        _log.ok("Adding users to group " + groupName);
      var uaaUri = self.options.vcapServices['predix-uaa'][0].credentials.uri + '/Groups/' + groupId;
      var headers = {
        'content-type': 'application/json',
        'authorization': 'Bearer ' + self.adminToken,
        'if-match': '*'
      };
      var data = {
        id: groupId,
        displayName: groupName,
        members: self.userIds
      }
      var options = {
        url: uaaUri,
        headers: headers,
        json: data
      };
      _requert.put(options, function (err, res, body) {
        if (err) return reject(err);
        if (res.statusCode >= 200 && res.statusCode < 400) {
          return resolve();
        }
        return reject(JSON.stringify(body, null,2));
      });
    });
  }



  this._setupUaaZones = function () {
    _log.ok('Setting up UAA zones ...');
    return new Promise(function (resolve, reject) {
      self._uaacAddGroups()
        .then(self._uaacAddMembers)
        .then(resolve)
        .catch(reject);
    });
  };

  

  this._uaacGetAdminToken = function () {
    return new Promise(function (resolve, reject) {
      var uaaUri = self.options.vcapServices['predix-uaa'][0].credentials.uri + '/oauth/token';

      var headers = {
        'content-type': 'application/x-www-form-urlencoded;charset=utf-8',
        'accept': 'application/json;charset=utf-8',
        'authorization': 'Basic ' + (new Buffer('admin' + ':' + self.cfAdminSecret)).toString('base64') 
      };
      var form = {
        grant_type: 'client_credentials'
      };
      var options = {
        url: uaaUri,
        headers: headers,
        form: form
      };
      _requert.post(options, function (err, res, body) {
        if (err) return reject(err);
        if (res.statusCode >= 200 && res.statusCode < 400) {
          self.adminToken = JSON.parse(body).access_token;
          return resolve(self.adminToken);
        }
        return reject(body);
      });
    });
  };

  return this;
};
