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

  it('should recover all the middlewares attached to a route and a method',
  function () {
    var mw1 = function () {};
    var mw2 = function () {};
    var mw3 = function () {};
    router.get('/a', mw1);
    router.get('/a', mw2);
    router.post('/a', mw3);
    router.get('/b', mw3);

    expect(router.match('get', '/a')).to.deep.equal([mw1, mw2]);
    expect(router.match('post', '/a')).to.deep.equal([mw3]);
    expect(router.match('get', '/b')).to.deep.equal([mw3]);
  });

});
