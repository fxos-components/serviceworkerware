'use strict';

var cacheHelper = require('sw-cache-helper');

var debug = 0 ? console.log.bind(console, '[SimpleOfflineCache]') : function(){};

function SimpleOfflineCache(cacheName) {
  this.cacheName = cacheName || cacheHelper.defaultCacheName;
  this.cache = null;
}

SimpleOfflineCache.prototype.onFetch = function soc_onFetch(request, response) {
  // If another middleware layer already have a response, the simple cache
  // just pass through the response and does nothing.
  if (response) {
    return Promise.resolve(response);
  }

  var clone = request.clone();
  debug('Handing fetch event: %s', clone.url);
  return this.ensureCache().then(function(cache) {
    return cache.match(request.clone()).then(function(res) {
      if (res) {
        return res;
      }

      return cacheHelper.fetchAndCache(request, cache);
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
