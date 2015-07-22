/* globals caches, Promise, Request */
'use strict';

function StaticCacher(fileList) {
  if (!Array.isArray(fileList) || fileList.length === 0) {
    throw new Error('Invalid file list');
  }
  this.files = fileList;
}

StaticCacher.prototype.onInstall = function sc_onInstall() {
  var self = this;
  return this.getDefaultCache().then(function(cache) {
    return self.addAll(cache, self.files);
  });
};

StaticCacher.prototype.getDefaultCache = function sc_getDefaultCache() {
  if (!this.cacheRequest) {
    this.cacheRequest = caches.open('offline');
  }
  return this.cacheRequest;
};

StaticCacher.prototype.addAll = function(cache, urls) {
  if (!cache) {
    throw new Error('Need a cache to store things');
  }
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
};

StaticCacher.prototype.fetchAndCache =
function sc_fetchAndCache(request, cache) {

  return fetch(request.clone()).then(function(response) {
    if (parseInt(response.status) < 400) {
      cache.put(request.clone(), response.clone());
    }
    return response;
  });
};


module.exports = StaticCacher;
