/* global fetch, BroadcastChannel, clients */
'use strict';

var debug = 1 ? console.log.bind(console, '[ServiceWorkerWare]') : function(){};
var StaticCacher = require('./staticcacher.js');
var SimpleOfflineCache = require('./simpleofflinecache.js');
var Router = require('./router.js');

function DEFAULT_FALLBACK_MW(request, response) {
  // XXX bug 1165860: To be modified when we get a better way of
  // stoping the middleware chain.
  if (response) {
    return Promise.resolve(response);
  }

  return fetch(request);
}

function ServiceWorkerWare(fallbackMw) {
  this.middleware = [];
  this.router = new Router({});
  this.router.proxyMethods(this);
  this.fallbackMw = fallbackMw || DEFAULT_FALLBACK_MW;
}

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
  debug('Event received: %s' + evt.type);
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
      debug('Unhandled event %s' + evt.type);
  }
};

ServiceWorkerWare.prototype.onFetch = function sww_onFetch(evt) {
  var steps = this.router.match(evt.request.method, evt.request.url);

  // Push the fallback middleware at the end of the list.
  steps.push(this.fallbackMw);

  evt.respondWith(steps.reduce(function(prevTaskPromise, currentTask) {
    debug('Applying middleware ' + currentTask.name);
    return prevTaskPromise.then(currentTask.bind(currentTask,
       evt.request.clone()));
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
  if (typeof mw === 'string') {
    path = arguments[0];
    mw = arguments[1];
    var kind = typeof mw;
    if (!mw || !(kind === 'object' || kind === 'function')) {
      throw new Error('No middleware specified');
    }
    if (Router.prototype.methods.indexOf(arguments[2]) !== -1) {
      method = arguments[2];
    }
  }

  this.middleware.push(mw);
  // Add to the router just if middleware object is able to handle onFetch
  // or if we have a simple function
  var handler = null;
  if (typeof mw.onFetch === 'function') {
    handler = mw.onFetch.bind(mw);
  } else if (typeof mw === 'function') {
    handler = mw;
  }
  if (handler) {
    this.router.add(method, path, handler);
  }
  // XXX: Attaching the broadcastMessage to mw that implements onMessage.
  // We should provide a way to get a reference to the SWW object and do
  // the broadcast from there
  if (typeof mw.onMessage === 'function') {
    mw.broadcastMessage = this.broadcastMessage;
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
      mw[handlerName].call(mw, evt);
    }
  });
};

/**
 * Broadcast a message to all worker clients
 * @param msg Object the message
 * @param channel String (Used just in Firefox Nightly) using broadcastchannel
 * api to deliver the message, this parameter can be undefined as we listen for
 * a channel undefined in the client.
 */
ServiceWorkerWare.prototype.broadcastMessage = function sww_broadcastMessage(
  msg, channel) {
  // XXX: Until https://bugzilla.mozilla.org/show_bug.cgi?id=1130685 is fixed
  // we can use BroadcastChannel API in Firefox Nightly
  if (typeof BroadcastChannel === 'function') {
    var bc = new BroadcastChannel(channel);
    bc.postMessage(msg);
    bc.close();
    return Promise.resolve();
  } else {
    // This is suppose to be the way of broadcasting a message, unfortunately
    // it's not working yet in Chrome Canary
    return clients.matchAll().then(function(consumers) {
      consumers.forEach(function(client) {
        client.postMessage(msg);
      });
    });
  }
};

module.exports = {
  ServiceWorkerWare: ServiceWorkerWare,
  StaticCacher: StaticCacher,
  SimpleOfflineCache: SimpleOfflineCache
};
