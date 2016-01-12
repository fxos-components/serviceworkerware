
var SW_TESTS = [
  '/base/lib/spec/router.sw-spec.js',
  '/base/lib/spec/simpleofflinecache.sw-spec.js',
  '/base/lib/spec/sww.sw-spec.js',
  '/base/lib/spec/staticcacher.sw-spec.js'
];

// Setup for Mocha BDD + Chai + Sinon
importScripts('/base/node_modules/chai/chai.js');
importScripts('/base/node_modules/sinon/pkg/sinon.js');
self.expect = chai.expect;
mocha.setup({ ui: 'bdd' });
