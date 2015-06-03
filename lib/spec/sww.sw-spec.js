importScripts('/base/lib/spec/nodeMock.js');

describe('ServiceWorkerWare', function () {
  'use strict';

  var originalRouter;

  before(function () {
    // XXX: See after() inside the suite. We need to save the global context.
    // Working on a better solution.
    originalRouter = Router;

    importScripts('/base/lib/spec/routerMock.js');
    self.require.mocks['./router.js'] = RouterMock;
    importScripts('/base/lib/sww.js');
  });

  after(function () {
    // XXX: See the beginning of the file. This part restore the global context.
    self.Router = originalRouter;
  });

  var fallbackResult = 'fallbackMW';
  var fallbackMW = function(req, res) {
    return fallbackResult;
  }

  var worker;
  var request;

  /**
   * This is an empty array at the beginning of each test. Push middlerwares
   * inside to force the router mock to return the list of middlewares you
   * define.
   */
  var middleware;

  beforeEach(function() {
    worker = new ServiceWorkerWare();
    request = {
      method: 'GET',
      url: 'https://www.example.com',
      clone: function() {}
    };
    middleware = [];
    sinon.stub(RouterMock.prototype, 'match').returns(middleware);
  });

  afterEach(function () {
    RouterMock.prototype.match.restore();
  });

  describe('fallback mw', function(done) {

    it('should fetch if no fallback middleware', function (done) {
      var result = 'ok';
      var stub = sinon.stub(self, 'fetch').returns(Promise.resolve(result));

      worker.onFetch({
        request: request,
        respondWith: function(chain) {
          return chain.then(function(response) {
            expect(self.fetch.called).to.be.true;
            expect(response).to.equal(result);
            stub.restore();
            done();
          }, function(err) {
            stub.restore();
            done(new Error(err));
          }).catch(function(err) {
            stub.restore();
            done(new Error(err));
          });;
        }
      })
    });

    it('should use fallback middleware if defined', function(done) {
      worker = new ServiceWorkerWare(fallbackMW);

      var spy = sinon.spy(self, 'fetch');

      worker.onFetch({
          request: request,
          respondWith: function(result) {
            result.then(function(res) {
              expect(spy.called).to.be.false;
              expect(res).to.equal(fallbackResult);
              spy.restore();
              done();
            }).catch(function(err) {
              spy.restore();
              done(new Error(err));
            })
          }
      });
    });

    it('should not use fallback mw if another mw replied', function(done) {
      worker = new ServiceWorkerWare();
      var mw = function(req, res) { return Promise.resolve('always'); };
      middleware.push(mw);

      var spy = sinon.spy(self, 'fetch');

      worker.onFetch({
        request: request,
        respondWith: function(result) {
          result.then(function(response) {
            expect(self.fetch.called).to.be.false;
            expect(response).to.equal('always');
            spy.restore();
            done();
          }).catch(function(err) {
            spy.restore();
            done(new Error(err));
          });
        }
      });
    });

    it('should use fallback mw if another mw didnt replied', function(done) {
      worker = new ServiceWorkerWare();
      var mw = function(req, res) {
        return Promise.resolve(undefined);
      };
      middleware.push(mw);

      var stub = sinon.stub(self, 'fetch', function() {
        return Promise.resolve('from_network');
      });

      worker.onFetch({
        request: request,
        respondWith: function(result) {
          result.then(function(response) {
            expect(stub.called).to.be.true;
            expect(response).to.equal('from_network');
            stub.restore();
            done();
          }).catch(function(err) {
            stub.restore();
            done(new Error(err));
          });
        }
      });
    });
  });

  describe('onFetch', function() {

    var evt;

    beforeEach(function () {
      evt = {
        request: new Request('http://example.com'),
        respondWith: function (promise) { this.onceFinished = promise; }
      };

      middleware.push(
        function mw1(req, res, end) { },
        function mw2(req, res, end) { },
        function mw3(req, res, end) { }
      );
    });

    it('test something', function () {
      worker.onFetch(evt);
      evt.onceFinished.then(function () {
        /* Let's assert here */
        RouterMock.prototype.match.restore();
      });
    });

  });
});
