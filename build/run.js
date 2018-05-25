/**
 * This nodejs app is trying to port the cloud_build, cloud_setup, cloud_push and other scripts
 * from python to nodejs
 *
 * author: Anh V. Nguyen (anhnv16@fsoft.com.vn)
 */

var _cli = require('commander'),
  _cmd = require('./libs/cmd'),
  _cloud = require('./libs/cloud'),
  _log = require('./libs/logger')
  ;

_cli
  .version('0.0.1')
  .arguments('<cmd> [sub]')
  .option('-e, --env [env]', 'Your isolated environment, default value is dev, this environment name will be added to services name and apps name as a suffix in following format: your_service_{env} for the services and your-app-{env} for the apps.', 'dev')
  .option('-c, --clean', 'Cleanup before run')

  .option('--cf-username [cf-username]', 'CloudFoundry username')
  .option('--cf-password [cf-password]', 'CloudFoundry password, the CF will ask you to enter this in runtime if this was not set')
  .option('--cf-endpoint [cf-endpoint]', 'CloudFoundry endpoint, default value is http://api.system.aws-usw02-pr.ice.predix.io/', 'http://api.system.aws-usw02-pr.ice.predix.io/')
  .option('--cf-org [cf-org]', 'CloudFoundry org')
  .option('--cf-space [cf-space]', 'CloudFoundry space')
  .option('--cf-bypasslogin', 'By pass login CloudFoundry')
  .option('--mvn-proxy-host', 'Maven proxy host')
  .option('--mvn-proxy-port', 'Maven proxy port')
  .option('--mvn-settings-file [mvn-settings-fie]', 'Maven settings file')

  .option('--cf-admin-secret [cf-admin-secret]', 'CloudFoundry admin secret', 'Pr3@1X2018')
  .option('--apps-config-path [apps-config-path]', "Apps config path", './configs/cf-apps-config')
  .option('--services-config-path [services-config-path]', "Apps config path", './configs/cf-services-config')
  .option('--users-config-path [users-config-path]', "Apps config path", './configs/cf-users-config')


  .option('--data-path [apps-data-path]', "Data path", '../data')

  .option('--backend-path [backend-path]', 'Backend path', '..')
  .option('--frontend-path [frontend-path]', 'Frontend path', '../predix-isk-ui')

  .option('--bypass-dummy-app', 'By pass push dummy app')
  .option('--bypass-logstash-service [bypass-logstash-service]', 'By pass create logstash service', true)
  .option('--use-uaac [use-uaac]', 'Using uaac for creating/updating users', true)
  .option('--enable-newrelic [enable-newrelic]', 'Enable newrelic momitoring or not', false)


  .action(function (cmd, sub) {
    _cli.apps = require(_cli.appsConfigPath);
    _cli.services = require(_cli.servicesConfigPath);
    _cli.users = require(_cli.usersConfigPath);
    _cli.uaaClientId = _cli.users.client.client_id
    _cli.uaaClientPassword = _cli.users.client.client_secret
    _cli.uaaClientBase64Token = (new Buffer(_cli.uaaClientId + ':' + _cli.uaaClientPassword)).toString('base64');
    _cli.vcapServices = {};
    _cli.vcapApplications = {};

    var processor = _cloud(_cli);
    if (typeof processor[cmd] === 'function') {
      var run = function () {
        var runCmd = function () {
          _log.info('Going to run ' + cmd);
          return processor[cmd](sub);
        };

        if (_cli.clean && cmd === 'setup') {
          _log.info('Going to clean up everything in env=' + _cli.env);
          processor.cleanup()
            .then(runCmd)
            .then(function () {
              _log.ok('OK DONE!!!');
            })
            .catch(function(e) {
                _log.error(e);
                process.exit(1);  
              });
        } else {
          runCmd()
            .then(function () {
              _log.ok('OK DONE!!!');
            })
            .catch(
              function(e) {
                _log.error(e);
                process.exit(1);  
              });
        }
      };
      if (!_cli.cfBypasslogin && _cli.cfUsername && _cli.cfPassword) {
        _log.info('Logging in to CloudFoundry...');
        var cfCmd = 'cf login -a <e> -u <u> -p <p>'
          .replace('<e>', _cli.cfEndpoint)
          .replace('<u>', _cli.cfUsername)
          .replace('<p>', _cli.cfPassword);
        if (_cli.cfOrg) {
          _log.ok('Org:'+ _cli.cfOrg);
          cfCmd += ' -o ' + '\"' + _cli.cfOrg + '\"';
        }
        if (_cli.cfSpace) {
          cfCmd += ' -s ' + _cli.cfSpace;
        }
        _cmd.run(cfCmd, {shhh: false}).then(run).catch(_log.error);
      } else {
        _log.info('By pass logging in to CloudFoundry...');
        run();
      }
    } else {
      _log.error('Invalid command!: ' + cmd);
      _log.error('Run with -h or --help');
      process.exit(1);
    }
  });

_cli.parse(process.argv);
