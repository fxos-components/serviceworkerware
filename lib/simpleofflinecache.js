/* global Promise, caches */
'use strict';

var debug = 0 ? console.log.bind(console, '[SimpleOfflineCache]') :
 function(){};

// Default Match options, not exposed.
var DEFAULT_MATCH_OPTIONS = {
  ignoreSearch: false,
  ignoreMethod: false,
  ignoreVary: false
};
var DEFAULT_MISS_POLICY = 'fetch';
// List of different policies
var MISS_POLICIES = [
  DEFAULT_MISS_POLICY
];

var DEFAULT_CACHE_NAME = 'offline';


/**
 * Constructor for the middleware that serves the content of a
 * cache specified by it's name.
 * @param {string} cacheName Name of the cache that will be serving the content
 * @param {object} [options] Object use to setup the cache matching alternatives
 * @param {string} [missPolicy] Name of the policy to follow if a request miss
 *                 when hitting the cache.
 */
function SimpleOfflineCache(cacheName, options, missPolicy) {
  this.cacheName = cacheName || DEFAULT_CACHE_NAME;
  this.options = options || DEFAULT_MATCH_OPTIONS;
  this.missPolicy = missPolicy || DEFAULT_MISS_POLICY;
  if (MISS_POLICIES.indexOf(this.missPolicy) === -1) {
    console.warn('Policy ' + missPolicy + ' not supported');
    this.missPolicy = DEFAULT_MISS_POLICY;
  }
}

SimpleOfflineCache.prototype.onFetch = function soc_onFetch(request, response) {
  // If another middleware layer already have a response, the simple cache
  // just pass through the response and does nothing.
  if (response) {
    return Promise.resolve(response);
  }

  var clone = request.clone();
  var _this = this;
  debug('Handing fetch event: ' + clone.url);
  return this.ensureCache().then(function(cache) {
    return cache.match(clone, _this.options).then(function(res) {
      if (res) {
        return res;
      }

      // So far we just support one policy
      switch(_this.missPolicy) {
        case DEFAULT_MISS_POLICY:
          return fetch(request);
      }
    });
  });
};

SimpleOfflineCache.prototype.ensureCache = function soc_ensureCache() {
  if (!this.cacheRequest) {
    this.cacheRequest = caches.open(this.cacheName);
  }
  return this.cacheRequest;
};

module.exports = SimpleOfflineCache;
