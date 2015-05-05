'use strict';

var cacheHelper = require('sw-cache-helper');

var debug = 0 ? console.log.bind(console, '[SimpleOfflineCache]') :
 function(){};

// Default Match options, not exposed.
var DEFAULT_MATCH_OPTIONS = {
  ignoreSearch: false,
  ignoreMethod: false,
  ignoreVary: false
};
// List of different policies
var MISS_POLICIES = [
  'fetchAndCache'
];


/**
 * Constructor for the middleware that serves the content of a
 * cache specified by it's name.
 * @param {string} cacheName Name of the cache that will be serving the content
 * @param {object} [options] Object use to setup the cache matching alternatives
 * @param {string} [missPolicy] Name of the policy to follow if a request miss
 *                 when hitting the cache.
 */
function SimpleOfflineCache(cacheName, options, missPolicy) {
  this.cacheName = cacheName || cacheHelper.defaultCacheName;
  this.cache = null;
  this.options = options || DEFAULT_MATCH_OPTIONS;
  if (MISS_POLICIES.indexOf(missPolicy) === -1) {
    console.warn('Policy ' + missPolicy + ' not supported');
    this.missPolicy = 'fetchAndCache';
  } else {
    this.missPolicy = MISS_POLICIES.indexOf(missPolicy);
  }
}

SimpleOfflineCache.prototype.onFetch = function soc_onFetch(request, response) {
  // If another middleware layer already have a response, the simple cache
  // just pass through the response and does nothing.
  if (response) {
    return Promise.resolve(response);
  }

  var clone = request.clone();
  var self = this;
  debug('Handing fetch event: %s', clone.url);
  return this.ensureCache().then(function(cache) {
    return cache.match(request.clone(), self.options).then(function(res) {
      if (res) {
        return res;
      }

      // So far we just support one policy
      switch(self.missPolicy) {
        case 'fetchAndCache':
          return cacheHelper.fetchAndCache(request, cache);
      }
    });
  });
};

SimpleOfflineCache.prototype.ensureCache = function soc_ensureCache() {
  if (this.cache) {
    return Promise.resolve(this.cache);
  }
  var self = this;
  return cacheHelper.getCache(this.cacheName).then(function(cache) {
    self.cache = cache;
    return cache;
  });
};

module.exports = SimpleOfflineCache;
