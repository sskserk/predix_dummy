/**
 * author: Anh V. Nguyen (anhnv16@fsoft.com.vn)
 *
 * This is the main part of the scripts, this script will interact with cf, uaac via shell to:
 * - Build backend and frontend code
 * - Clean up environment
 * - Login to CloudFoundry
 * - Start a dummy app (just a small peace of nodejs code).
 * - Create independent services such as predix-uaa, postgres, redis, rabbitmq with isolated env and bind these services to the dummy app
 * - Read the uaa's issuerId from VCAP_SERVICES of the dummy app
 * - Create the services (predix-views, predix-timeseries, predix-acs) which have uaa as the dependency with the trustedIssuerId is the issuerId has been read above and bind these services to the dummy app.
 * - Automatically configure uaa for creating user, client, group, zone, member for predix-views, predix-timeseries, predix-acs
 * - Bind services to applications.
 * - Setup the environment variables for applications.
 * - Generate the manifest.yml file, the generated file name will be in this format: generated.manifest.{env}.yml.
 * - Push apps
 */

var _cmd = require('./cmd'),
  _yml = require('js-yaml'),
  _fs = require('fs'),
  _log = require('./logger'),
  _requert = require('request'),
  _user = require('./users'),
  _newrelic = require('./newrelic')
  ;

module.exports = function (options) {
  var self = this;
  this.options = options || {};
  //this.dummyAppName = 'dummy-app-' + options.env;
  this.dummyAppName = 'data-app-' + options.env;
  this.manifestPath = '<p>/<a>/generated.manifest.<e>.yml'.replace('<p>', self.options.backendPath || '..').replace('<e>', self.options.env);

  // cloning arrays instead of set ref
  this.appStacks = [this.options.apps.slice(0)];
  this.serviceStacks = [this.options.services.slice(0)];
 _log.ok(JSON.stringify(this.appStacks));
  
  this.userp = _user(options);
  this.newrelicProcessor =  _newrelic(this.options.env);

  this._cmdCreateServices = function (service) {
    _log.ok('Going to create service <s> ...'.replace('<s>', service.name));
    var c = 'cf create-service <n> <p> <i>'
      .replace('<n>', service.name)
      .replace('<p>', service.plan)
      .replace('<i>', service.instance + '_' + self.options.env);
    if (service.parameters) {
      c += (' -c "' + self._parameters(service.parameters) + '"');
    }
    return c;
  };

  this._cmdBindServices = function (appName, service) {
    _log.ok('Going to bind service <s> to app <a> ...'.replace('<s>', service.name).replace('<a>', appName));
    return 'cf bind-service <a> <s>'
      .replace('<a>', appName)
      .replace('<s>', service.instance + '_' + self.options.env);
  };

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

  this._parseVcaps = function (apps) {
    return Promise.all(apps.map(function(app) {
            appName = app.name + "-" + self.env;
            return this._parseVcap(null, appName);
          }));
  };

  this._findAvailableServices = function () {
    _log.ok('Finding available services for shared-vm, free .....');
     return new Promise(function (resolve, reject) {
       return _cmd.run('cf m ')
        .then(function (data) {
          data = data.stdout.replace(/\n/g, '').replace(/ /g, '');
          self.options.services.forEach(function (service) {
            if (service.regex) {
                reg = RegExp(service.regex, "g")
                res = data.match(reg);
                _log.ok(JSON.stringify(res, 2, null));
                service['available-services'] = res;
            }
        });
        })
        .then(resolve)
        .catch(reject);
      
});
}


  this._parseParameter = function (parameter, prefix) {
      prefix = prefix || 'options.';
      _log.ok('Parsing <p> with prefix <px> ...'.replace('<p>', parameter).replace('<px>', prefix));
      var values = parameter.match(/^.*\{(.*)\}.*$/);
      return values && values.length > 1 ? eval(prefix + values[1]) : parameter;
  };

  this._parameters = function (paramTpl) {
    _log.ok('Parsing parameters template <p> ...'.replace('<p>', paramTpl));
    var param = {};
    for (var k in paramTpl) {
      if (typeof paramTpl[k] === 'string') {
        param[k] = self._parseParameter(paramTpl[k]);
      } else if (Array.isArray(paramTpl[k])) {
        param[k] = [self._parseParameter(paramTpl[k][0])];
      } else {
        for (j in paramTpl[k]) {
          result = self._parseParameter(paramTpl[k][j]);
          paramTpl[k][j] = result;
        }
        param[k] = paramTpl[k];
      }
    }
    return JSON.stringify(param).replace(/"/g, '\\"');
  };

  this._setupServices = function () {
    _log.ok('Setting up services ...');
    _log.ok(self.userprocessor);
    var resolve = function(service){
      return _cmd.run(self._cmdBindServices(self.dummyAppName, service)).then(function () {
        // FIXME: temporary if/else right here since we need to setup uaa client/user right after binding uaa service
        return service.name === 'predix-uaa'
          ? self._parseVcap().then(self.userp.setupUaaClientUser)
          : Promise.resolve();
      });
    };

    this._setupOneService = function(service) {
      if (service.regex) {
          var availableServices = service['available-services'];
          if(availableServices) {
           serviceName = availableServices.pop();
           if (serviceName) {
             service.name = serviceName;
             _log.ok("Creating service " + serviceName);
             return _cmd.run(self._cmdCreateServices(service))
             .then(resolve.bind(self, service))
             .catch(
                function() {
                  return self._setupOneService(service);
                }
              );
           } else {
              return Promise.reject();
           }
         } else {
          return Promise.reject();
        }
      } else {
        return _cmd.run(self._cmdCreateServices(service)).then(resolve.bind(self, service));
      }
    };


    return self.serviceStacks.reduce(function (p, services) {
      return p.then(function () {
          return Promise.all(services.map(function (service) {
              return self._setupOneService(service);
        })).then(self._parseVcap);
      });
    }, Promise.resolve());
  };





  this._bindStandaloneServices = function () {
    _log.ok('Binding stand-alone services ...');
    return Promise.all(self.options.services.filter(function (e) {
      return !e.dependencies || e.dependencies.length === 0;
    }).map(function (service) {
      return _cmd.run(self._cmdBindServices(self.dummyAppName, service));
    }));
  };

  this._setupDependentServices = function () {
    _log.ok('Setting up dependent services ...');
    return Promise.all(self.options.services.filter(function (e) {
      return e.dependencies && e.dependencies.length > 0;
    }).map(function (service) {
      return _cmd.run(self._cmdCreateServices(service));
    }));
  };

  this._bindDependentServices = function () {
    _log.ok('Binding dependent services ...');
    return Promise.all(self.options.services.filter(function (e) {
      return e.dependencies && e.dependencies.length > 0;
    }).map(function (service) {
      return _cmd.run(self._cmdBindServices(self.dummyAppName, service));
    }));
  };

  this._deleteServices = function () {
    _log.ok('Deleting services ...');
    return Promise.all(self.options.services.map(function (service) {
      	 return _cmd.run(
        'cf delete-service <service_name> -f'.replace('<service_name>', service.instance + '_' + self.options.env),
        {allowFailure: true}
      )
    }));
  };

  this._deleteApps = function () {
    _log.ok('Deleting apps ...');
    return Promise.all(self.options.apps.map(function (app) {
      return self._deleteApp(null, app.name + '-' + self.options.env);
    }));
  };

  this._buildBackend = function () {
    _log.ok('Building backend ...');
    var mvnCmd = 'mvn clean install -f <backend_path>/pom.xml'.replace('<backend_path>', self.options.backendPath || '..');
    if (self.options.mvnProxyHost) {
      mvnCmd += ' -Dhttps.proxyHost=' + self.options.mvnProxyHost;
    }
    if (self.options.mvnProxyPort) {
      mvnCmd += ' -Dhttps.proxyPort=' + self.options.mvnProxyPort;
    }
    if (self.options.mvnSettingsFile) {
      mvnCmd += ' -s ' + self.options.mvnSettingsFile
    }
    _log.ok(self.options.mvnSettingsFile);
    return _cmd.run(mvnCmd);
  };

  this._buildFrontend = function () {
    _log.ok('Building frontend ...');
	_log.ok(self.options.frontendPath);
    return _cmd.run('cd <frontend_path> && npm install && bower install --force-latest && grunt dist --force'.replace('<frontend_path>', self.options.frontendPath));
  };

  this._pushApp = function (appName, additionalInfoPush) {
    appName = appName || self.dummyAppName;
    _log.ok('Pushing app <a> ...'.replace('<a>', appName));
    // var path = appName === self.dummyAppName ? './dummy-app/manifest.yml' : self.manifestPath.replace('<a>', appName);
    var path = appName === self.dummyAppName ? './data-app/manifest.yml' : self.manifestPath.replace('<a>', appName);
    var name = appName === self.dummyAppName ? appName : '';
    var additionalInfo = ' ';
    if (typeof additionalInfoPush !== 'undefined' && additionalInfoPush !== '') {
      additionalInfo = additionalInfo + additionalInfoPush;
    }
    var cmdStr = 'cf push ' + name + ' -f ' + path + additionalInfo;
    if (appName === self.dummyAppName) {
      cmdStr += ' --no-start';
    }
    return _cmd.run(cmdStr);
  };


  this._deleteApp = function (_, appName) {
    appName = appName || self.dummyAppName;
    _log.ok('Deleting app <a> ...'.replace('<a>', appName));
    return _cmd.run('cf delete ' + appName + ' -f');
  };

  this._generateManifest = function (app) {
    _log.ok('Generating manifest.yml for <a> ...'.replace('<a>', app.name + '-' + self.options.env));
    return new Promise(function (resolve, reject) {
		
      var appManifest = {
        'applications': [
          {
            'name': app.name,
            'memory': '1G',
            'instances': app.instances || '1',
            'services': [],
            'env': {}
          }
        ]
      };
	  
	 if(app.buildpack) {
		appManifest.applications[0].buildpack = app.buildpack;
	 }
	 
	 if(app.path) {
		appManifest.applications[0].path = app.path;
	 }
	 
	 if(self.options.env) {
		appManifest.applications[0].name = app.name + '-' + self.options.env;
	 }
	 
      appManifest.applications[0].services = app.services.map(function (s) {

        //append the env to the service instance name
        var name = '';
        if(self.options.env) {
         name = s && (s + '_' + self.options.env);
        } else {
         name = s;
        }
        
        // update services name for app env right here
        appManifest.applications[0].env[s.replace(/-/g, '_').toUpperCase() + '_NAME'] = name;
        return name;
      });

      //add New Relic service
      if (self.options.enableNewrelic) {
         appManifest.applications[0].services.push(self.newrelicProcessor._getNewRelicServiceName());
      }

      var redisService = "";
      for(var i in options.vcapServices) {
        if (i && i.indexOf('redis') >= 0) {
          redisService = i;
          _log.ok("Redis instance : " + redisService);
          break;
        }
      }

      //replace {redis-?} in env parameters before calling parsing function
      for (var k in app.env) {
        param = app.env[k];
        param = param.replace('{redis-?}', redisService);
        appManifest.applications[0].env[k] = self._parseParameter(param);
      }

      if (app.dependencies && app.dependencies.length > 0) {
        app.dependencies.map(function (a) {
          var prefix = 'options.vcapApplications[\'<a>\'].'.replace('<a>', a.name + '-' + self.options.env);
          appManifest.applications[0].env[a.env] =
            '<p><v><s>'.replace('<p>', a.prefix || '')
              .replace('<v>', self._parseParameter(a.value, prefix))
              .replace('<s>', a.suffix || '');
        });
      }



      // FIXME: Temporary hard-code the way we get UAA_NAME
      //appManifest.applications[0].env['UAA_NAME'] = self.options.services.find(function (e){ return e.name === 'predix-uaa'; }).instance + '_' + self.options.env;

      _fs.writeFile(self.manifestPath.replace('<a>', app.name), _yml.dump(appManifest), function (err) {
        return err ? reject(err) : resolve();
      })
    });
  };

   this._pushApps = function (appName) {
    if (appName) {
          _log.ok('Pushing app <a>...'.replace('<a>', appName));
            app =  self.options.apps.find(function(e) {
               return e.name === appName;
            }); 
            if (app.dependencies) {
            return self._parseVcaps(app.dependencies)
            .then( function() {
              return self._generateManifest(app);
            })
            .then(function () {
              return self._pushApp(app.name, app.additionalInfoPush).then(function () {
                return self._parseVcap(null, app.name + '-' + self.options.env);
              });
            });
          } else {
            return self._generateManifest(app)
              .then(function () {
              return self._pushApp(app.name, app.additionalInfoPush).then(function () {
                return self._parseVcap(null, app.name + '-' + self.options.env);
              });
          });
       }   
    } else {
    _log.ok('Pushing apps ...');
    return self.appStacks.reduce(function (p, apps) {
      return p.then(function () {
        return Promise.all(apps.map(function (app) {
          return self._generateManifest(app)
            .then(function () {
              return self._pushApp(app.folder || app.name, app.additionalInfoPush).then(function () {
                return self._parseVcap(null, app.name + '-' + self.options.env);
              });
            });
        }));
      });
    }, Promise.resolve());
   }
  };


  this._pushDependentApps = function () {
    _log.ok('Pushing dependent apps');
    return Promise.all(self.options.apps.filter(function (e) {
      return e.apps && e.apps.length > 0;
    }).map(function (app) {
      return self._generateManifest(app)
        .then(function () {
          return self._pushApp(app.name, app.additionalInfoPush);
        });
    }));
  };

  this._buildStacks = function (stacks) {
    var i = stacks.length - 1;
    var nextStack = stacks[i].filter(function (app) {
      if (!app.dependencies || app.dependencies.length === 0) return false;
      return app.dependencies.map(function (a) {
        return a.name;
      }).some(function (n) {
        return stacks[i].map(function (s) {
            return s.name;
          }).indexOf(n) > -1;
      });
    });
    if (nextStack.length > 0) {
      stacks.push(nextStack);
      nextStack.map(function (e) {
        var index = stacks[i].map(function (a) {
          return a.name;
        }).indexOf(e.name);
        if (index > -1) {
          stacks[i].splice(index, 1);
        }
      });
      self._buildStacks(stacks);
    }
  };

  this._getClientToken = function () {
    return new Promise(function (resolve, reject) {
      var uaaUri = self.options.vcapServices['predix-uaa'][0].credentials.uri + '/oauth/token';
      var headers = {
        'content-type': 'application/x-www-form-urlencoded;charset=utf-8',
        'accept': 'application/json;charset=utf-8',
        'authorization': 'Basic ' + self.options.uaaClientBase64Token
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
        if (res.statusCode >= 200 && res.statusCode < 400) return resolve(JSON.parse(body).access_token);
        return reject(body);
      });
    });
  };

  this._buildStacks(this.appStacks);
  this._buildStacks(this.serviceStacks);

  /**
   * clean up
   * @returns {Promise}
   */
  this.cleanup = function () {
    return new Promise(function (resolve, reject) {
      self._deleteApp()
        .then(self._deleteApps)
        .then(self._deleteServices)
        .then(resolve)
        .catch(reject);
    });
  };

  /**
   * clean up
   * @returns {Promise}
   */
  this.deleteapps = function () {
    return new Promise(function (resolve, reject) {
      self._deleteApps()
        .then(resolve)
        .catch(reject);
    });
  };

  /**
   * build
   * @returns {Promise}
   */
  this.build = function () {
    return new Promise(function (resolve, reject) {
      self._buildBackend()
        .then(self._buildFrontend)
        .then(resolve)
        .catch(reject);
    });
  };

  /**
   * setup
   * @returns {Promise}
   */
  this.setup = function () {
    return new Promise(function (resolve, reject) {
      self._pushApp()
        .then(self._findAvailableServices)
        .then(self._setupServices)
        .then(self.userp.collectZones)
        .then(self.userp.uaacUpdateClient)
        .then(self.userp.setupUaaZones)
        .then(resolve)
        .catch(reject);
    });
  };

 /**
   * push
   * @returns {Promise}
   */
   this.push = function (appName) {
    return new Promise(function (resolve, reject) {
      self._parseVcap()
      .then(self.newrelicProcessor._createNewRelicService)
      .then(function() {
          return self._pushApps(appName);
      })
      .then(resolve)
      .catch(reject);
    });
   };


  /**
   * Enable New Relic monitoring
   * @returns {Promise}
   */
   this.enableNewrelic = function (appName) {
    return new Promise(function (resolve, reject) {
      self.newrelicProcessor.enableNewRelicMonitoring(appName)
      .then(resolve)
      .catch(reject);
    });
  };


  /**
   * Disable New Relic monitoring
   * @returns {Promise}
   */
   this.disableNewrelic = function (appName) {
    return new Promise(function (resolve, reject) {
      self._parseVcap()
      .then(self.newrelicProcessor.disableNewRelicMonitoring(appName))
      .then(resolve)
      .catch(reject);
    });
  };

  /**
   * do all tasks
   * @returns {Promise}
   */
  this.all = function () {
    return new Promise(function (resolve, reject) {
      self.build()
        .then(self.cleanup)
        .then(self.setup)
        .then(self.push)
        .then(resolve)
        .catch(reject);
    });
  };

  return this;
};

