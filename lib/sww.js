/* global fetch */
'use strict';

var debug = 0 ? console.log.bind(console, '[ServiceWorkerWare]') : function(){};
var StaticCacher = require('./staticcacher.js');
var SimpleOfflineCache = require('./simpleofflinecache.js');
var Router = require('./router.js');

function ServiceWorkerWare() {
  this.middleware = [];
  this.router = new Router({});
  this.router.proxyMethods(this);
}

ServiceWorkerWare.prototype.defaultCacheName = 'offline';

ServiceWorkerWare.prototype.init = function sww_init() {
  // lifecycle events
  addEventListener('install', this);
  addEventListener('activate', this);
  addEventListener('beforeevicted', this);
  addEventListener('evicted', this);

  // network events
  addEventListener('fetch', this);

  // misc events
  addEventListener('message', this);
  // XXX: Add default configuration
};

/**
 * Handle and forward all events related to SW
 */
ServiceWorkerWare.prototype.handleEvent = function sww_handleEvent(evt) {
  debug('Event received: %s', evt.type);
  switch(evt.type) {
    case 'install':
      this.onInstall(evt);
      break;
    case 'fetch':
      this.onFetch(evt);
      break;
    case 'activate':
    case 'message':
    case 'beforeevicted':
    case 'evicted':
      this.forwardEvent(evt);
      break;
    default:
      debug('Unhandled event %s', evt.type);
  }
};

ServiceWorkerWare.prototype.onFetch = function sww_onFetch(evt) {
  var steps = this.router.match(evt.request.method, evt.request.url);
  if (steps.length === 0) {
    // XXX: we should have at least 1 basic middle ware that we install
    // and can be overwritten. So far ... go to the network :(
    return fetch(evt.request);
  }
  evt.respondWith(steps.reduce(function(prevTaskPromise, currentTask) {
    return prevTaskPromise.then(currentTask.bind(currentTask, evt.request.clone()));
  }, Promise.resolve(null)));
};

/**
 * Walk all the middle ware installed asking if they have prerequisites
 * (on the way of a promise to be resolved) when installing the SW
 */
ServiceWorkerWare.prototype.onInstall = function sww_oninstall(evt) {
  var waitingList = [];
  this.middleware.forEach(function(mw) {
    if (typeof mw.onInstall !== 'undefined') {
      waitingList.push(mw.onInstall());
    }
  });
  evt.waitUntil(Promise.all(waitingList));
};

/**
 * Register a new middleware layer, they will treat the request in
 * the order that this layers have been defined.
 * A middleware layer can behave in the ServiceWorker in two ways:
 *  - Listening to SW lifecycle events (install, activate, message).
 *  - Handle a request.
 * To handle each case (or both) the middleware object should provide
 * the following methods:
 * - on<SW LiveCiclyeEvent>: for listening to SW lifeciclye events
 * - onFetch: for handling fetch urls
 */
ServiceWorkerWare.prototype.use = function sww_use() {
  // If the first parameter is not a function we will understand that
  // is the path to handle, and the handler will be the second parameter
  if (arguments.length === 0) {
    throw new Error('No arguments given');
  }
  var mw = arguments[0];
  var path = '/';
  var method = this.router.ALL_METHODS;
  if (typeof mw !== 'object') {
    path = arguments[0];
    mw = arguments[1];
    if (!mw || typeof mw !== 'object') {
      throw new Error('No middleware specified');
    }
    if (Router.prototype.methods.indexOf(arguments[2]) !== -1) {
      method = arguments[2];
    }
  }

  this.middleware.push(mw);
  // Add to the router just if it's able to handle onFetch
  if (typeof mw.onFetch === 'function') {
    this.router.add(method, path, mw.onFetch.bind(mw));
  }
};


/**
 * Forward the event received to any middleware layer that has a 'on<Event>'
 * handler
 */
ServiceWorkerWare.prototype.forwardEvent = function sww_forwardEvent(evt) {
  this.middleware.forEach(function(mw) {
    var handlerName = 'on' + evt.type.replace(/^[a-z]/,
      function(m){
         return m.toUpperCase();
      }
    );
    if (typeof mw[handlerName] !== 'undefined') {
      mw[handlerName].call(mw.handler, evt);
    }
  });
};

module.exports = {
  ServiceWorkerWare: ServiceWorkerWare,
  StaticCacher: StaticCacher,
  SimpleOfflineCache: SimpleOfflineCache
};

