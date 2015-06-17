'use strict';

describe('Static cacher', function() {

  var defaultCacheName = 'offline';
  var requestMap = {
    'http://www.example.com/': 'response1',
    'http://www.mozilla.org/': 'response2',
  };
  var defaultUrls = Object.keys(requestMap);
  var defaultStaticCacher;

  before(function() {
    importScripts('/base/lib/staticcacher.js');
    defaultStaticCacher = new StaticCacher(defaultUrls);
  });

  beforeEach(function() {
    sinon.stub(self, 'fetch', function(request) {
      var response = new Response(requestMap[request.url], {});
      return Promise.resolve(response);
    });
  });

  afterEach(function() {
    self.fetch.restore();
    return clearDefaultCache();
  });

  function clearDefaultCache() {
    return caches.open(defaultCacheName).then(function(cache) {
      return cache.keys().then(function(response) {
        response.forEach(function(element) {
          cache.delete(element);
        });
      });
    });
  }

  function expectTextInOfflineCache(request, expectedText) {
    return caches.open(defaultCacheName).then(function(cache) {
      return cache.match(request);
    }).then(function(response) {
      return response.text();
    }).then(function(text) {
      expect(text).to.equal(expectedText);
    });
  }


  describe('The constructor', function() {

    it('should accept an array of files', function() {
      expect(function() {
        new StaticCacher(['file1', 'file2'])
      }).to.not.throw(Error);
    });

    it('should throw an error if no argument is provided', function() {
      expect(function() {
        new StaticCacher();
      }).to.throw(Error, 'Invalid file list');
    });

    it('should throw an error if the argument is not an array', function() {
      expect(function() {
        new StaticCacher('invalidString');
      }).to.throw(Error, 'Invalid file list');
    });

    it('should throw if the array is empty', function() {
      expect(function() {
        new StaticCacher([]);
      }).to.throw(Error, 'Invalid file list');
    });
  });

  describe('onInstall()', function() {

    it('should return a promise', function() {
      expect(defaultStaticCacher.onInstall()).to.be.an.instanceOf(Promise);
    });

    it('should store responses in the default cache', function() {
      sinon.spy(defaultStaticCacher, 'getDefaultCache');

      return defaultStaticCacher.onInstall().then(function() {
        var promises = defaultUrls.map(function(url) {
          return expectTextInOfflineCache(new Request(url), requestMap[url]);
        });
        return Promise.all(promises)
      });
    });
  });

  describe('getDefaultCache()', function() {
    it('should return the cache named "offline"', function() {
      var cacheGot;

      return defaultStaticCacher.getDefaultCache().then(function(cache) {
        cacheGot = cache;
        return caches.open(defaultCacheName)
      }).then(function(expectedCache) {
        expect(cacheGot).to.equal(expectedCache);
      });
    });
  });

  describe('addAll()', function() {
    afterEach(function() {
      defaultStaticCacher.fetchAndCache.restore();
    });

    it('should work as polyfill', function() {
      sinon.stub(defaultStaticCacher, 'fetchAndCache', function(request, cache) {
        var response = new Response(requestMap[request.url], {
          status: 200
        });
        return cache.put(request.clone(), response.clone());
      });

      var defaultCache;

      return defaultStaticCacher.getDefaultCache().then(function(cache) {
        defaultCache = cache;

        cache.addAll = undefined;
        return defaultStaticCacher.addAll(cache, defaultUrls);
      }).then(function() {
        var promises = defaultUrls.map(function(url) {
          return expectTextInOfflineCache(new Request(url), requestMap[url]);
        });
        return Promise.all(promises);
      });
    });
  });

  describe('fetchAndCache()', function() {
    var content = 'my content';

    beforeEach(function() {
      self.fetch.restore();
    })

    it('should fetch and cache url a valid resource', function() {
      sinon.stub(self, 'fetch', function() {
        var response = new Response(content, {});
        return Promise.resolve(response);
      });

      var defaultCache;

      return defaultStaticCacher.getDefaultCache().then(function(cache) {
        defaultCache = cache;
      }).then(function() {
        return defaultStaticCacher.fetchAndCache(new Request(defaultUrls[0]), defaultCache);
      }).then(function() {
        return defaultCache.match(new Request(defaultUrls[0]));
      }).then(function(response) {
        return response.text();
      }).then(function(text) {
        expect(text).to.be.equal(content);
      });
    });

    it('should not cache invalid resource', function() {
      sinon.stub(self, 'fetch', function() {
        var response = new Response('invalid content', {
          status: 401
        });
        return Promise.resolve(response);
      });

      var defaultCache;

      return defaultStaticCacher.getDefaultCache().then(function(cache) {
        defaultCache = cache;
        return defaultStaticCacher.fetchAndCache(new Request(defaultUrls[0]), defaultCache);
      }).then(function() {
        sinon.assert.calledOnce(self.fetch);
        return defaultCache.match(new Request(defaultUrls[0]));
      }).then(function(response) {
        expect(response).to.be.undefined;
      });
    });
  });
});
