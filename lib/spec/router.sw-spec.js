describe('Router instances', function () {
  'use strict';

  var router;

  before(function () {
    importScripts('/base/lib/spec/nodeMock.js');
    importScripts('/base/lib/router.js');
  });

  beforeEach(function() {
    router = new Router();
  });

  describe('add()', function() {
    var handler = function(){};

    it('should push new route to the stack', function () {
      router.add('get', '/', handler);
      expect(router.stack[0]).to.deep.equal({
        method: 'get',
        path: new RegExp('/$'),
        namedPlaceholders: [],
        handler: handler
      });
    });

    it('should accept the "all" method', function() {
      router.add('all', '/', handler);
      expect(router.stack[0].method).to.equal('all');
    });

    it('should sanitize the method name', function() {
      sinon.spy(router, '_sanitizeMethod');
      router.add('get', '/', handler);
      expect(router._sanitizeMethod.calledWith('get')).to.be.true
    });
  });

  describe('utility wrappers', function() {
    it('router.methods should contain the standard HTTP verbs and "all"', function() {
      expect(router.methods).to.contain('get');
      expect(router.methods).to.contain('post');
      expect(router.methods).to.contain('put');
      expect(router.methods).to.contain('delete');
      expect(router.methods).to.contain('head');
      expect(router.methods).to.contain('all');
      expect(router.methods.length).to.be.equal(6);
    });

    it('should have defined methods for available verbs', function() {
      router.methods.forEach(function (verb) {
        expect(router[verb]).to.be.defined;
      });
    });

    it('should wrap add()', function() {
      var handler = function() {};
      sinon.spy(router, 'add');
      router.get('/', handler);
      expect(router.add.calledWith('get', '/', handler)).to.be.true;
    });
  });

  describe('proxyMethods()', function() {
    var object;

    beforeEach(function() {
      object = {};
    });

    it('should proxy the methods to an object', function () {
      router.proxyMethods(object);
      router.methods.forEach(function (verb) {
        expect(object[verb]).to.be.defined;
      });
    });

    describe('function as handler', function() {
      var handler = function() {};

      it('should wrap add()', function() {
        sinon.spy(router, 'add');
        router.proxyMethods(object);
        object.get('/', handler);
        expect(router.add.calledWith('get', '/', handler)).to.be.true;
      });
    });

    describe('Object as handler', function() {
      var handler = {
        onFetch: function() {}
      };

      it('should wrap add()', function() {
        sinon.spy(router, 'add');
        router.proxyMethods(object);
        object.get('/', handler);
        // We don't check the argument passed because onFetch gets bound
        // so the passed function is not the same
        expect(router.add.calledOnce).to.be.true;
      });

      it('should call onFetch()', function() {
        sinon.spy(handler, 'onFetch');
        router.proxyMethods(object);
        object.get('/', handler);
        router.stack[0].handler();
        expect(handler.onFetch.calledOnce).to.be.true;
      });

      it('onFetch() should bind "this" to the handler', function() {
        var thisInOnFetch;
        var handler = {
          onFetch: function() {
            thisInOnFetch = this;
          }
        };

        router.proxyMethods(object);
        object.get('/', handler);
        router.stack[0].handler();

        expect(thisInOnFetch).to.deep.equal(handler);
      });

      it('should throw an error if the object does not have onFetch()', function() {
        var invalidHandler = {};
        router.proxyMethods(object);
        expect(function() { object.get('/', invalidHandler); }).to.throw(Error, 'This middleware cannot handle fetch request')
      });
    });
  });

  describe('_sanitizeMethod()', function() {
    it('should lowercase the method name', function () {
      expect(router._sanitizeMethod('GET')).to.equal('get');
    });

    it('should trim the spaces around', function () {
      expect(router._sanitizeMethod('  get ')).to.equal('get');
    });

    it('should throw Error when a method is not supported', function () {
      expect(function() { router._sanitizeMethod('invalidMethod') })
        .to.throw(Error, 'Method "invalidMethod" is not supported');
    });
  });

  describe('Matching algorithm', function() {

    describe('match()', function() {
      var mw = function () {};

      describe('`__params` attribute', function () {

        it('exists although no parameters are present in the url', function () {
          router.get('/', mw);
          var matched = router.match('get', '/')[0];
          expect(matched.__params).to.be.an('object');
          expect(Object.keys(matched.__params).length).to.equal(0);
        });

        it('contains an attribute for each named placeholder', function () {
          router.get('/:band/:album', mw);

          var matched = router.match('get', '/judas-priest/painkiller')[0];
          var params = matched.__params;

          expect(Object.keys(params).length).to.equal(2);
          expect(params['band']).to.equal('judas-priest');
          expect(params['album']).to.equal('painkiller');
        });

        it('contains names varying according to the placeholders in the routes',
        function () {
          var mw2 = function () {};
          router.get('/:band/:album', mw);
          router.get('/:collection/:id', mw2);

          var matches = router.match('get', '/judas-priest/painkiller');

          var matched = matches[0];
          var params = matched.__params;

          expect(Object.keys(params).length).to.equal(2);
          expect(params['band']).to.equal('judas-priest');
          expect(params['album']).to.equal('painkiller');

          matched = matches[1];
          params = matched.__params;

          expect(Object.keys(params).length).to.equal(2);
          expect(params['collection']).to.equal('judas-priest');
          expect(params['id']).to.equal('painkiller');
        });

        it('supports numeric names', function () {
          router.get('/:1/:0', mw);

          var matched = router.match('get', '/judas-priest/painkiller')[0];
          var params = matched.__params;

          expect(Object.keys(params).length).to.equal(2);
          expect(params[1]).to.equal('judas-priest');
          expect(params[0]).to.equal('painkiller');
        });

        it('ignores anonymous placeholders', function () {
          router.get('/*/:band/:album', mw);

          var matched = router.match('get', '/foo/judas-priest/painkiller')[0];
          var params = matched.__params;

          expect(Object.keys(params).length).to.equal(2);
          expect(params['band']).to.equal('judas-priest');
          expect(params['album']).to.equal('painkiller');
        });

        it('ignores anonymous placeholder crowding', function () {
          router.get('/***/:band/:album', mw);

          var matched = router.match('get', '/foo/judas-priest/painkiller')[0];
          var params = matched.__params;

          expect(Object.keys(params).length).to.equal(2);
          expect(params['band']).to.equal('judas-priest');
          expect(params['album']).to.equal('painkiller');
        });
      });

      it('should match a single middleware', function() {
        router.get('/', mw);
        expect(router.match('get', '/')).to.deep.equal([mw]);
      });

      it('should match multiple middlewares in the same order as they were added', function() {
        var mw2 = function () {};
        router.get('/', mw);
        router.get('/', mw2);
        expect(router.match('get', '/')).to.deep.equal([mw, mw2]);
      });

      it('should match a regular expression', function() {
        router.get('/[0-9]+', mw);
        expect(router.match('get', '/1')).to.deep.equal([mw]);
        expect(router.match('get', '/')).to.be.empty;
      });

      it('should sanitize the method name', function() {
        router.get('/', mw);
        sinon.spy(router, '_sanitizeMethod');
        router.match('get', '/')
        expect(router._sanitizeMethod.calledWith('get')).to.be.true
      });

      it('should return an empty array if there is no middleware attached to this particular method', function() {
        router.get('/', mw);
        expect(router.match('post', '/')).to.be.empty;
      });

      it('should distinguish between middlewares attached to different methods', function() {
        var mw2 = function () {};
        router.get('/', mw);
        router.post('/', mw2);
        expect(router.match('get', '/')).to.deep.equal([mw]);
      });

      it('should distinguish between middlewares attached to different URL', function() {
        router.get('/a', mw);
        router.get('/b', mw);
        expect(router.match('get', '/a')).to.deep.equal([mw]);
      });

      describe('"all" method', function() {
        it('should match every single method', function() {
          router.all('/', mw);
          expect(router.match('get', '/')).to.deep.equal([mw]);
          expect(router.match('post', '/')).to.deep.equal([mw]);
          expect(router.match('put', '/')).to.deep.equal([mw]);
          expect(router.match('delete', '/')).to.deep.equal([mw]);
          expect(router.match('head', '/')).to.deep.equal([mw]);
        });

        it('should match "all"', function() {
          router.all('/', mw);
          expect(router.match('all', '/')).to.deep.equal([mw]);
        });
      });

      it('should match exactly with no placeholders', function() {
        var mw2 = function() {};

        router.get('/foo/', mw);
        router.get('/foo/bar', mw2);

        expect(router.match('get', '/foo')).to.be.empty;
        expect(router.match('get', '/foo/')).to.deep.equal([mw]);
        expect(router.match('get', '/foo/bar')).to.deep.equal([mw2]);
        expect(router.match('get', '/foo/bar/')).to.be.empty;
      });

      it('should match anonymous placeholders (*)', function() {
        router.get('*', mw);

        expect(router.match('get', '/')).to.deep.equal([mw]);
        expect(router.match('get', '/foo/bar')).to.deep.equal([mw]);
      });

      it('should match all anonymous placeholders (*) in order', function() {
        var mw2 = function () {},
            mw3 = function () {};

        router.get('*', mw);
        router.get('/foo/bar', mw2);
        router.get('*', mw3);

        expect(router.match('get', '/')).to.deep.equal([mw, mw3]);
        expect(router.match('get', '/foo/bar')).to.deep.equal([mw, mw2, mw3]);
      });

      it('trailing placeholders (/foo/* etc.) should match arbitrary prefixes', function() {
        var mw2 = function () {};

        router.get('/foo/*', mw);
        router.get('/foo/bar/*', mw2);

        expect(router.match('get', '/')).to.be.empty;
        expect(router.match('get', '/foo')).to.be.empty;
        expect(router.match('get', '/foo/')).to.deep.equal([mw]);
        expect(router.match('get', '/foo/bar')).to.deep.equal([mw]);
        expect(router.match('get', '/foo/bar/baz')).to.deep.equal([mw, mw2]);
      });

      it('infix placeholders (/foo/*/bar etc.) should match arbitrary path chunks', function() {
        var mw2 = function () {};

        router.get('/foo*bar', mw);
        router.get('/foo/*/bar', mw2);

        expect(router.match('get', '/')).to.be.empty;
        expect(router.match('get', '/foo')).to.be.empty;
        expect(router.match('get', '/foo/bar')).to.deep.equal([mw]);
        expect(router.match('get', '/foo/doh/bar')).to.deep.equal([mw, mw2]);
      });

      it('multiple placeholders (/foo/*/bar/* etc) should be allowed', function() {
        var mw2 = function () {},
            mw3 = function () {};

        router.get('/pre/*/fix/*', mw);
        router.get('*/suf/*/fix', mw2);
        router.get('*inner*', mw3);

        expect(router.match('get', '/')).to.be.empty;
        expect(router.match('get', '/pre/123/fix/')).to.deep.equal([mw]);
        expect(router.match('get', '/pre/123/fix/456')).to.deep.equal([mw]);
        expect(router.match('get', '/pre/123/')).to.be.empty;

        expect(router.match('get', '/matched/suf/123/fix')).to.deep.equal([mw2]);
        expect(router.match('get', '/any/other/suf/123/456/fix')).to.deep.equal([mw2]);
        expect(router.match('get', '/suf/nopre/fix')).to.deep.equal([mw2]);
        expect(router.match('get', '/fix')).to.be.empty;

        expect(router.match('get', '/pre/suf/fix/')).to.deep.equal([mw]);

        expect(router.match('get', '/inner')).to.deep.equal([mw3]);
        expect(router.match('get', '/beginners')).to.deep.equal([mw3]);
        expect(router.match('get', '/pre/inner/fix/')).to.deep.equal([mw, mw3]);
        expect(router.match('get', '/inner/suf/other/fix')).to.deep.equal([mw2, mw3]);
        expect(router.match('get', '/inner/suf/other/fix/')).to.deep.equal([mw3]);

        expect(router.match('get', '/pre/123/fix/inner/suf/456/fix/')).to.deep.equal([mw, mw3]);
        expect(router.match('get', '/pre/123/fix/inner/suf/456/fix')).to.deep.equal([mw, mw2, mw3]);
        expect(router.match('get', '/pre/suf/inner/fix/')).to.deep.equal([mw, mw3]);
      });

      it('named placeholders (:foo) must match at least one character (no empty matches allowed)', function() {
        router.get('/:foo', mw);
        expect(router.match('get', '/')).to.be.empty;
        expect(router.match('get', '/foo')).to.deep.equal([mw]);
        expect(router.match('get', '/foo/bar')).to.deep.equal([mw]);
      });

      it('placeholder crowding for anonymous placeholder (**) should be treated same as a single placeholder', function() {
        var mw2 = function () {};

        expect(function() { router.get('/f**bar', mw); }).to.not.throw();
        expect(function() { router.get('/foo/bar/***', mw); }).to.not.throw();
        router.get('/f*bar', mw2);

        expect(router.match('get', '/foo')).to.deep.equal(router.match('get', '/foo'));
        expect(router.match('get', '/foobar')).to.deep.equal(router.match('get', '/foobar'));
        expect(router.match('get', '/foobabarbar')).to.deep.equal(router.match('get', '/foobabarbar'));
        expect(router.match('get', '/foo/bar/baz')).to.deep.equal(router.match('get', '/foo/bar/baz'));
        expect(router.match('get', '/foo/doh/bar')).to.deep.equal(router.match('get', '/foo/doh/bar'));
      });

      it('placeholder crowding for named placeholder (:foo:bar) should throw', function() {
        expect(function () { router.get('/foo/:bar:baz', mw); }).to.throw(Error, 'Invalid usage of named placeholders');
        expect(function () { router.get('/foo/:bar:baz:shoo', mw); }).to.throw(Error, 'Invalid usage of named placeholders');
      });

      it('mixed crowdings (*:foo, :bar** etc.) should throw', function() {
        expect(function () { router.get('/foo/*:bar', mw); }).to.throw(Error, 'Invalid usage of named placeholders');
        expect(function () { router.get('/:foo**/:bar', mw); }).to.throw(Error, 'Invalid usage of named placeholders');
        expect(function () { router.get('/foo/\\*:bar', mw); }).to.not.throw();
      });
    });

    describe('_parseSimplePath()', function() {
      it('on invalid path specification it should throw an error', function() {
        expect(function () { router._parseSimplePath(']['); }).to.throw(Error, 'Invalid path specified');
      });

      it('should support anonymous placeholders (*)', function() {
        expect(router._parseSimplePath('/a*b').regexp.source).to.equal("\\/a(?:.*?)b$");
      });

      it('should collapse anonymous placeholder crowding (**)', function() {
        expect(router._parseSimplePath('/a**b').regexp.source).to.equal("\\/a(?:.*?)b$");
      });

      it('should support named placeholders (:foo)', function() {
        expect(router._parseSimplePath('/a/:foo/b').regexp.source).to.equal("\\/a\\/(.+?)\\/b$");
      });

      it('should support multiple/mixed placeholders (*, :foo)', function() {
        expect(router._parseSimplePath('/a/*/*/b').regexp.source).to.equal("\\/a\\/(?:.*?)\\/(?:.*?)\\/b$");
        expect(router._parseSimplePath('/a/:foo/:bar/b').regexp.source).to.equal("\\/a\\/(.+?)\\/(.+?)\\/b$");
        expect(router._parseSimplePath('/a/*/:foo/b').regexp.source).to.equal("\\/a\\/(?:.*?)\\/(.+?)\\/b$");
      });

      it('should support escaping of placeholder special characters (* and :)', function() {
        expect(router._parseSimplePath('/a\\*/*/b').regexp.source).to.equal("\\/a\\*\\/(?:.*?)\\/b$");
        expect(router._parseSimplePath('/a/:foo\\:80/b').regexp.source).to.equal("\\/a\\/(.+?):80\\/b$");
      });
    });

  });

});
