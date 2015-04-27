importScripts('/base/lib/spec/nodeMock.js');
importScripts('/base/lib/router.js');

describe('Router instances', function () {
  'use strict';

  var router;

  beforeEach(function() {
    router = new Router();
  })

  it('should have defined methods for available verbs', function () {
    expect(router.methods).to.be.defined;
    expect(router.methods.length).to.be.at.least(1);
    expect(router.methods).to.contain('all');
    router.methods.forEach(function (verb) {
      expect(router[verb]).to.be.defined;
    });
  });

  it('should proxy the methods to an object', function () {
    var obj = {};
    var mw = function () {};
    sinon.spy(router, 'add');
    router.proxyMethods(obj);
    router.methods.forEach(function (verb) {
      expect(obj[verb]).to.be.defined;
    });
    obj.get('/', mw);
    expect(router.add.calledWith('get', '/', mw)).to.be.true;
  });

  describe('add()', function() {
    it('should push new route to the stack', function () {
      var handler = function(){};

      router.add('get', '/', handler);
      expect(router.stack[0]).to.deep.equal({
        method: 'get',
        path: new RegExp('/'),
        handler: handler
      });
    });

    it('should push a route with "all" methods', function() {
      var handler = function(){};
      router.add('all', '/', handler);
      expect(router.stack[0].method).to.equal('all');
    });

    it('should lowercase the method name', function () {
      router.add('GET', '/', function(){});
      expect(router.stack[0].method).to.equal('get');
    });

    it('should throw Error when a method is not supported', function () {
      expect(function() { router.add('invalidMethod') }).to.throw(Error, 'Method "invalidmethod" is not supported');
    });

    it('should throw Error when an extra space is provided', function () {
      expect(function() { router.add('get ') }).to.throw(Error, 'Method "get " is not supported');
    });
  });

  describe('match()', function() {
    var defaultMiddleware = function () {};

    it('should match a single middleware', function() {
      router.get('/a', defaultMiddleware);
      expect(router.match('get', '/a')).to.deep.equal([defaultMiddleware]);
    });

    it('should match multiple middlewares', function() {
      var mw2 = function () {};
      router.get('/a', defaultMiddleware);
      router.get('/a', mw2);
      expect(router.match('get', '/a')).to.deep.equal([defaultMiddleware, mw2]);
    });

    it('should match a regular expression', function() {
      router.get('/[0-9]+', defaultMiddleware);
      expect(router.match('get', '/1')).to.deep.equal([defaultMiddleware]);
    });

    it('should prevent from matching a regular expression', function() {
      router.get('/[0-9]+', defaultMiddleware);
      expect(router.match('get', '/')).to.deep.equal([]);
    });

    it('should lowercase the method name', function() {
      router.get('/', defaultMiddleware);
      expect(router.match('GET', '/')).to.deep.equal([defaultMiddleware]);
    });

    it('should return an empty array if the method name is unknown', function() {
      expect(router.match('invalidMethod', '/')).to.deep.equal([]);
    });

    it('should return an empty array if there is no middleware attached to this particular method', function() {
      router.get('/', defaultMiddleware);
      expect(router.match('post', '/')).to.deep.equal([]);
    });

    it('should return only one middleware even if multiple are attached to the same route (but not the same method)', function() {
      var mw2 = function () {};
      router.get('/a', defaultMiddleware);
      router.post('/a', mw2);
      expect(router.match('get', '/a')).to.deep.equal([defaultMiddleware]);
    });

    it('should return only one middleware even if the same middleware was attached to multiple routes', function() {
      router.get('/a', defaultMiddleware);
      router.get('/b', defaultMiddleware);
      expect(router.match('get', '/a')).to.deep.equal([defaultMiddleware]);
    });

    describe('"all" method', function() {
      it('should match every single method', function() {
        router.all('/a', defaultMiddleware);
        expect(router.match('get', '/a')).to.deep.equal([defaultMiddleware]);
        expect(router.match('post', '/a')).to.deep.equal([defaultMiddleware]);
        expect(router.match('put', '/a')).to.deep.equal([defaultMiddleware]);
        expect(router.match('delete', '/a')).to.deep.equal([defaultMiddleware]);
        expect(router.match('head', '/a')).to.deep.equal([defaultMiddleware]);
      });

      it('should match "all"', function() {
        router.all('/a', defaultMiddleware);
        expect(router.match('all', '/a')).to.deep.equal([defaultMiddleware]);
      });

      // Currently failing
      it('should not match an invalid method', function() {
        router.all('/a', defaultMiddleware);
        expect(router.match('invalidMethod', '/a')).to.deep.equal([]);
      });
    });
  });

});
