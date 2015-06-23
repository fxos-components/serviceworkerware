importScripts('/base/lib/spec/nodeMock.js');

describe('request object passed to middleware', function () {
  'use strict';

  var originalRouter;

  before(function () {
    originalRouter = Router;

    importScripts('/base/lib/spec/routerMock.js');
    self.require.mocks['./router.js'] = RouterMock;
    importScripts('/base/lib/sww.js');
  });

  after(function () {
    self.Router = originalRouter;
  });

  var worker;

  beforeEach(function() {
    worker = new ServiceWorkerWare();
  });

  describe('params property', function () {

    var evt;
    var middleware;
    var mw;

    /**
     * Modify this variable to test parameters in the URL.
     */
    var url;

    function getParams() {
      var request = mw.getCall(0).args[0];
      // TODO: Why is not working?
      expect(request.params).to.be.defined;
      return request.params;
    }

    beforeEach(function () {
      mw = sinon.stub().returns(Promise.resolve(new Response('')));
      middleware = [mw];
      sinon.stub(RouterMock.prototype, 'match').returns(middleware);

      evt = {
        request: new Request(url),
        respondWith: function (promise) {
          if (!promise || !promise.then) { promise = Promise.resolve(promise); }
          this.onceFinished = promise.then(getParams);
        }
      };
    });

    afterEach(function () {
      RouterMock.prototype.match.restore();
    });

    it('contains the values for named placeholders', function () {
      mw.route = '/:collection/:id';
      url = '/bands/judas-priest';

      worker.onFetch(evt);

      return evt.onceFinished.then(function (params) {
        expect(Object.keys(params).length).to.equal(2);
        expect(params['collection']).to.equal('bands');
        expect(params['id']).to.equal('judas-priest');
      });
    });

  });
});
