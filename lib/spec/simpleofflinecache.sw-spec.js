/* global caches, Response, Promise, SimpleOfflineCache, expect, sinon,
Request */
/* jshint -W030 */
importScripts('/base/lib/spec/nodeMock.js');
importScripts('/base/lib/simpleofflinecache.js');

describe('SimpleOfflineCache instance', function () {
  'use strict';

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
      return db.put(request.clone(), response.clone());
    })
    .then(function () {
      return offline.onFetch(request.clone(), response);
    })
    .then(function (returned) {
      expect(returned).to.equal(response);
      done();
    })
    .catch(function (reason) {
      done(new Error(reason));
    });
  });

  it('should cache the promise for requested cache', function(done) {
    var offline = new SimpleOfflineCache('cachedCache');
    var cacheObj = {
      match: sinon.stub().returns(Promise.resolve({}))
    };
    sinon.stub(caches, 'open').returns(Promise.resolve(cacheObj));
    offline.onFetch(new Request('/'), null).then(function() {
      offline.onFetch(new Request('/'), null).then(function() {
        expect(caches.open.calledOnce).to.be.true;
        caches.open.restore();
        done();
      });
    }).catch(function(reason) {
      caches.open.restore();
      done(new Error(reason));
    });
  });

  it('should fetch from network if the resource is not available',
  function (done) {
    var offline = new SimpleOfflineCache('test');
    var request = new Request('/');
    sinon.spy(self, 'fetch');
    offline.onFetch(request.clone(), null)
    .then(function () {
      expect(fetch.calledOnce).to.be.true;
      expect(fetch.getCall(0).args[0].url).to.equal(request.url);
      fetch.restore();
      done();
    })
    .catch(function (reason) {
      fetch.restore();
      done(new Error(reason));
    });
  });

  it('should pass match parameters', function(done) {
    var cacheName = 'test';
    var options = {
      ignoreSearch: true,
      ignoreMethod: false,
      ignoreVary: false,
      prefixMatch: false
    };
    var offline = new SimpleOfflineCache(cacheName, options);

    var request = new Request('/index.html?param=zzz');

    var cacheObj = {
      match: sinon.stub().returns(Promise.resolve({}))
    };
    // Clean the cached request
    delete offline.cacheRequest;
    sinon.stub(caches, 'open').returns(
      Promise.resolve(cacheObj));
    offline.onFetch(request).then(function() {
      expect(cacheObj.match.called).to.be.true;
      expect(cacheObj.match.calledWith(request, options)).to.be.true;
      caches.open.restore();
      done();
    })
    .catch(function(err) {
      caches.open.restore();
      done(new Error(err));
    });
  });
});
