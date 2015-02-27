/* global caches, fetch, Promise, Request*/
'use strict';

var CacheHelper = {
  defaultCacheName: 'offline',
  getCache: function getCache(name) {
    return caches.open(name);
  },
  getDefaultCache: function getDefaultCache() {
    return this.getCache(this.defaultCacheName);
  },
  fetchAndCache: function fetchAndChache(request, cache) {
    return fetch(request.clone()).then(function(response) {
      var clone = response.clone();
      if (parseInt(clone.status) < 400) {
        cache.put(request.clone(), response.clone());
      }

      return response.clone();
    });
  },
  addAll: function addAll(cache, urls) {
    // Polyfill until chrome implements it
    if (typeof cache.addAll !== 'undefined') {
      return cache.addAll(urls);
    }

    var promises = [];
    var self = this;
    urls.forEach(function(url) {
      promises.push(self.fetchAndCache(new Request(url), cache));
    });

    return Promise.all(promises);
  }
};

module.exports = CacheHelper;
