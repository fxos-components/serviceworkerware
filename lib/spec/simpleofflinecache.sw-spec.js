importScripts('/base/lib/spec/nodeMock.js');
importScripts('/base/lib/simpleofflinecache.js');

var isChrome = navigator.userAgent.indexOf('Chrome') != -1;

describe('SimpleOfflineCache instance', function () {
  'use strict';

  self.cacheHelper = {
    getCache: caches.open.bind(caches),
    fetchAndCache: function (request, cache) {
      var response = new Response('network response');
      return cache.put(request.clone(), response.clone()).then(function() {
        return response;
      });
    }
  };

  beforeEach(function (done) {
    caches.keys().then(function (names) {
      Promise.all(names.map(caches.delete.bind(caches)))
      .then(function () { done(); })
      .catch(function (reason) { done(new Error(reason)); });
    });
  });

  it('should ensure the cache we are requesting (creating if needed)',
  function (done) {
    var offline = new SimpleOfflineCache('test');

    offline.ensureCache()
    .then(caches.keys.bind(caches))
    .then(function (caches) {
      expect(caches).to.deep.equal(['test']);
      done();
    })
    .catch(function (reason) {
      done(new Error(reason));
    });
  });

  it('should answer with a stored copy of a resource', function (done) {
    var offline = new SimpleOfflineCache('test');
    var request = new Request('/');
    var response = new Response('contents');
    caches.open('test')
    .then(function (db) {
      return db.put(request.clone(), response.clone());
    })
    .then(function () {
      return offline.onFetch(request.clone(), null);
    })
    .then(function (response) {
      expect(response).to.be.ok;
      return response.text();
    })
    .then(function (body) {
      expect(body).to.equal('contents');
      done();
    })
    .catch(function (reason) {
      done(new Error(reason));
    });
  });

  it('should pass through if a response is already provided', function (done) {
    var offline = new SimpleOfflineCache('test');
    var request = new Request('/');
    var response = new Response('contents');
    caches.open('test')
    .then(function (db) {
      return db.put(request.clone(), response.clone())
    })
    .then(function () {
      return offline.onFetch(request.clone(), response)
    })
    .then(function (returned) {
      expect(returned).to.equal(response);
      done();
    })
    .catch(function (reason) {
      done(new Error(reason));
    });
  });

  it('should fetch from network and cache if the resource is not available',
  function (done) {
    var offline = new SimpleOfflineCache('test');
    var request = new Request('/');
    var response = new Response('contents');
    offline.onFetch(request.clone(), null)
    .then(function () {
      return caches.open('test');
    })
    .then(function (cache) {
      return cache.match(request.clone());
    })
    .then(function (response) {
      expect(response).to.be.ok;
      done();
    })
    .catch(function (reason) {
      done(new Error(reason));
    });
  });

  if (!isChrome) {
    it('should respect ignoreSearch when matching', function(done) {
      var cacheName = 'test';
      var options = {
        ignoreSearch: true,
        ignoreMethod: false,
        ignoreVary: false,
        prefixMatch: false,
        cacheName: cacheName
      };
      var offline = new SimpleOfflineCache(cacheName, options);
      var request = new Request('/index.html?param=zzz');
      var response = new Response('contents');
      caches.open(cacheName)
      .then(function (cache) {
        return cache.put(request.clone(), response.clone());
      })
      .then(function() {
        var searchRequest = new Request('/index.html?param=xyz');
        return offline.onFetch(searchRequest, null);
      })
      .then(function(response) {
        expect(response).to.be.ok;
        expect(response.text()).to.equal('contents');
        done();
      })
      .catch(function(err) {
        done(new Error(err));
      });
    });

  }
});
