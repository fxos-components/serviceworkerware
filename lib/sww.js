/* global fetch, BroadcastChannel, clients, Promise, Request, Response */
'use strict';

var debug = function(){};
// @ifdef DEBUG
debug = console.log.bind(console, '[ServiceWorkerWare]');
// @endif

// @ifdef DEBUG
performanceMark('sww_parsed');
// @endif

var StaticCacher = require('./staticcacher.js');
var SimpleOfflineCache = require('./simpleofflinecache.js');
var Router = require('./router.js');

var ERROR = 'error';
var CONTINUE = 'continue';
var TERMINATE = 'terminate';
var TERMINATION_TOKEN = {};

function DEFAULT_FALLBACK_MW(request) {
  return fetch(request);
}

function ServiceWorkerWare(options) {
  options = options || {};
  if (typeof options === 'function' || options.onFetch) {
    options = { fallbackMiddleware: options };
  }
  options.autoClaim = ('autoClaim' in options) ? options.autoClaim : true;
  this.middleware = [];
  this.router = new Router({});
  this.router.proxyMethods(this);

  this.fallbackMw = options.fallbackMiddleware || DEFAULT_FALLBACK_MW;
  this.autoClaim = options.autoClaim;
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

  // push notifications
  addEventListener('push', this);

  // XXX: Add default configuration
};

/**
 * Handle and forward all events related to SW
 */
ServiceWorkerWare.prototype.handleEvent = function sww_handleEvent(evt) {
  // @ifdef DEBUG
  performanceMark('event_' + evt.type + '_start');
  // @endif

  debug('Event received: ' + evt.type);
  switch(evt.type) {
    case 'install':
      this.onInstall(evt);
      break;
    case 'fetch':
      this.onFetch(evt);
      break;
    case 'activate':
      this.onActivate(evt);
      break;
    case 'push':
    case 'message':
    case 'beforeevicted':
    case 'evicted':
      this.forwardEvent(evt);
      break;
    default:
      debug('Unhandled event ' + evt.type);
  }
};

ServiceWorkerWare.prototype.onFetch = function sww_onFetch(evt) {
  var steps = this.router.match(evt.request.method, evt.request.url);

  // Push the fallback middleware at the end of the list.
  // XXX bug 1165860: Decorating fallback MW with `stopIfResponse` until
  // 1165860 lands
  steps.push((function(req, res) {
    if (res) {
      return Promise.resolve(res);
    }
    return this.fallbackMw(req, res);
  }).bind(this));

  evt.respondWith(this.executeMiddleware(steps, evt.request));

  // @ifdef DEBUG
  performanceMark('event_fetch_end');
  // @endif
};

/**
 * Run the middleware pipeline and inform if errors preventing respondWith()
 * to swallow the error.
 *
 * @param {Array} the middleware pipeline
 * @param {Request} the request for the middleware
 */
ServiceWorkerWare.prototype.executeMiddleware = function (middleware, request) {
  var response = this.runMiddleware(middleware, 0, request, null);
  response.catch(function (error) { console.error(error); });
  return response;
};

/**
 * Pass through the middleware pipeline, executing each middleware in a
 * sequence according to the result from each execution.
 *
 * Each middleware will be passed with the request and response from the
 * previous one in the pipeline. The response from the latest one will be
 * used to answer from the service worker. The middleware will receive,
 * as the last parameter, a function to stop the pipeline and answer
 * immediately.
 *
 * A middleware run can lead to continuing execution, interruption of the
 * pipeline or error. The next action to be performed is calculated according
 * the conditions of the middleware execution and its return value.
 * See normalizeMwAnswer() for details.
 *
 * @param {Array} middleware pipeline.
 * @param {Number} middleware to execute in the pipeline.
 * @param {Request} the request for the middleware.
 * @param {Response} the response for the middleware.
 */
ServiceWorkerWare.prototype.runMiddleware =
function (middleware, current, request, response) {
  if (current >= middleware.length) {
    return Promise.resolve(response);
  }

  var mw = middleware[current];
  if (request) { request.parameters = mw.__params; }
  var endWith = ServiceWorkerWare.endWith;
  var answer = mw(request, response, endWith);
  var normalized =
    ServiceWorkerWare.normalizeMwAnswer(answer, request, response);

  return normalized.then(function (info) {
    switch (info.nextAction) {
      case TERMINATE:
        return Promise.resolve(info.response);

      case ERROR:
        return Promise.reject(info.error);

      case CONTINUE:
        var next = current + 1;
        var request = info.request;
        var response = info.response;
        return this.runMiddleware(middleware, next, request, response);
    }
  }.bind(this));
};

/**
 * A function to force interruption of the pipeline.
 *
 * @param {Response} the response object that will be used to answer from the
 * service worker.
 */
ServiceWorkerWare.endWith = function (response) {
  if (arguments.length === 0) {
    throw new Error('Type error: endWith() must be called with a value.');
  }
  return [TERMINATION_TOKEN, response];
};

/**
 * A middleware is supposed to return a promise resolving in a pair of request
 * and response for the next one or to indicate that it wants to answer
 * immediately.
 *
 * To allow flexibility, the middleware is allowed to return other values
 * rather than the promise. For instance, it is allowed to return only a
 * request meaning the next middleware will be passed that request but the
 * previous response untouched.
 *
 * The function takes into account all the scenarios to compute the request
 * and response for the next middleware or the intention to terminate
 * immediately.
 *
 * @param {Any} non normalized answer from the middleware.
 * @param {Request} request passed as parameter to the middleware.
 * @param {Response} response passed as parameter to the middleware.
 */
ServiceWorkerWare.normalizeMwAnswer = function (answer, request, response) {
  if (!answer || !answer.then) {
    answer = Promise.resolve(answer);
  }
  return answer.then(function (value) {
    var nextAction = CONTINUE;
    var error, nextRequest, nextResponse;
    var isArray = Array.isArray(value);

    if (isArray && value[0] === TERMINATION_TOKEN) {
      nextAction = TERMINATE;
      nextRequest = request;
      nextResponse = value[1] || response;
    }
    else if (value === null) {
      nextRequest = request;
      nextResponse = null;
    }
    else if (isArray && value.length === 2) {
      nextRequest = value[0];
      nextResponse = value[1];
    }
    else if (value instanceof Response) {
      nextRequest = request;
      nextResponse = value;
    }
    else if (value instanceof Request) {
      nextRequest = value;
      nextResponse = response;
    }
    else {
      var msg = 'Type error: middleware must return a Response, ' +
                'a Request, a pair [Response, Request] or a Promise ' +
                'resolving to one of these types.';
      nextAction = ERROR;
      error = new Error(msg);
    }

    return {
      nextAction: nextAction,
      request: nextRequest,
      response: nextResponse,
      error: error
    };
  });
};

/**
 * Walk all the middleware installed asking if they have prerequisites
 * (on the way of a promise to be resolved) when installing the SW.
 */
ServiceWorkerWare.prototype.onInstall = function sww_oninstall(evt) {
  var installation = this.getFromMiddleware('onInstall');
  evt.waitUntil(installation);

  // @ifdef DEBUG
  performanceMark('event_install_end');
  // @endif
};

/**
 * Walk all the installed middleware asking if they have prerequisites
 * (on the way of a promise to be resolved) when SW activates.
 */
ServiceWorkerWare.prototype.onActivate = function sww_activate(evt) {
  var activation = this.getFromMiddleware('onActivate');
  if (this.autoClaim) {
    activation =
      activation.then(function claim() { return self.clients.claim(); });
  }
  evt.waitUntil(activation);

  // @ifdef DEBUG
  performanceMark('event_activate_end');
  // @endif
};

/**
 * Returns a promise gathering the results for executing the same method for
 * all the middleware.
 * @param {Function} the method to be executed.
 * @param {Promise} a promise resolving once all the results have been gathered.
 */
ServiceWorkerWare.prototype.getFromMiddleware =
function sww_getFromMiddleware(method) {
  var tasks = this.middleware.reduce(function (tasks, mw) {
    if (typeof mw[method] === 'function') {
      tasks.push(mw[method]());
    }
    return tasks;
  }, []);
  return Promise.all(tasks);
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
  var path = '*';
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

ServiceWorkerWare.decorators = {

  ifNoResponse: function (mw) {
    return function (req, res, endWith) {
      if (res) { return [req, res]; }
      return mw(req, res, endWith);
    };
  },

  stopAfter: function (mw) {
    return function (req, res, endWith) {
      var answer = mw(req, res, endWith);
      var normalized = ServiceWorkerWare.normalizeMwAnswer(answer, req, res);

      return normalized.then(function (info) {
        if (info.nextAction === 'error') {
          return Promise.reject(info.error);
        }
        return endWith(info.response);
      });
    };
  }
};

// @ifdef DEBUG
// Used in debugging, to save performance marks.
// Remember than in Firefox we have the performance API in workers
// but we don't have it in Chrome.
function performanceMark(name) {
  if (performance && performance.mark) {
    performance.mark(name);
  }
}
// @endif

module.exports = {
  ServiceWorkerWare: ServiceWorkerWare,
  StaticCacher: StaticCacher,
  SimpleOfflineCache: SimpleOfflineCache
};
