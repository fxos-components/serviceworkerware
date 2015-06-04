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

  var fallbackResult = new Response('fallbackMW');
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
      var result = new Response('ok');
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
          });
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
      var result = new Response('always');
      var mw = function(req, res) { return Promise.resolve(result); };
      middleware.push(mw);

      var spy = sinon.spy(self, 'fetch');

      worker.onFetch({
        request: request,
        respondWith: function(result) {
          result.then(function(response) {
            expect(self.fetch.called).to.be.false;
            expect(response).to.equal(response);
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

      var networkResponse = new Response('from_network');
      var stub = sinon.stub(self, 'fetch', function() {
        return Promise.resolve(networkResponse);
      });

      worker.onFetch({
        request: request,
        respondWith: function(result) {
          result.then(function(response) {
            expect(stub.called).to.be.true;
            expect(response).to.equal(networkResponse);
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

  describe('middleware running inside onFetch()', function() {

    var evt;
    var initialRequest, initialResponse;
    var initialMw, spyMw;

    beforeEach(function () {
      evt = {
        request: new Request('http://example.com'),
        respondWith: function (promise) {
          if (!promise || !promise.then) { promise = Promise.resolve(promise); }
          this.onceFinished = promise;
        }
      };

      initialRequest = new Request('http://example.com');
      initialResponse = new Response('contents');
      initialMw = function () {
        return Promise.resolve([initialRequest, initialResponse]);
      };
      spyMw = sinon.stub().returns(Promise.resolve(new Response('')));

      worker.onerror = sinon.spy();
    });

    /**
     * A convenient wrapper to write the same test twice, one for testing
     * middlerwares returning plain values and another for those returning
     * promises. The test implementation      *
     *
     * @param {string} the message for the test.
     *
     * @param {any} the value to be tested against. Once it will be passed
     * as is. The other it will be wrapped in a promise.
     *
     * @param {function} the test implementation. It should accept two
     * parameters, first is the value to be returned by the middleware, the
     * other is the original value sent to the wrapper.
     *
     * One of the calls to the test implementation will receive the value
     * wrapped inside a promise. The other time, it will receive the plain
     * value.
     */
    function promiseOptional(msg, returnValue, test) {
      var originalValue = returnValue;

      it(msg, function () {
        returnValue = Promise.resolve(originalValue);
        return test(returnValue, originalValue);
      });

      var noPromiseMsg = msg + ' (no need for promise)';
      it(noPromiseMsg, function () {
        return test(returnValue, originalValue);
      });
    }

    it('can pass new values for request and response explicitely', function () {
      var targetMw = initialMw;

      middleware.push(targetMw, spyMw);

      worker.onFetch(evt);

      return evt.onceFinished.then(function () {
        expect(spyMw.calledOnce).to.be.true;
        expect(spyMw.calledWith(initialRequest, initialResponse)).to.be.true;
      });
    });

    promiseOptional(
      'fail with error if returning something other than a Request / Response',
      'other thing',
      function (returnValue) {
        var targetMw = function () { return returnValue; };

        middleware.push(initialMw, targetMw, spyMw);

        worker.onFetch(evt);

        return evt.onceFinished.then(function (answer) {
          throw new Error("onFetch() mustn't answer with a fulfilled promise.");
        }, function (error) {
          expect(error).to.be.an.instanceof(Error);
        });
      }
    );

    promiseOptional(
      'can pass a new value only for request',
      new Request('http://mozilla.org'),
      function (returnValue, newRequest) {
        var targetMw = function (req, res, endWith) {
          return returnValue;
        };

        middleware.push(initialMw, targetMw, spyMw);

        worker.onFetch(evt);

        return evt.onceFinished.then(function () {
          expect(spyMw.calledOnce).to.be.true;
          expect(spyMw.calledWith(newRequest, initialResponse)).to.be.true;
        });
      }
    );

    promiseOptional(
      'can pass a new value only for response',
      new Response('more contents'),
      function (returnValue, newResponse) {
        var targetMw = function (req, res, endWith) {
          return returnValue;
        };

        middleware.push(initialMw, targetMw, spyMw);

        worker.onFetch(evt);

        return evt.onceFinished.then(function () {
          expect(spyMw.calledOnce).to.be.true;
          expect(spyMw.calledWith(initialRequest, newResponse)).to.be.true;
        });
      }
    );

    promiseOptional(
      'can pass the same values by returning undefined',
      undefined,
      function (returnValue) {
        var targetMw = function (req, res, endWith) {
          return returnValue;
        };

        middleware.push(initialMw, targetMw, spyMw);

        worker.onFetch(evt);

        return evt.onceFinished.then(function () {
          expect(spyMw.calledOnce).to.be.true;
          expect(spyMw.calledWith(initialRequest, initialResponse)).to.be.true;
        });
      }
    );

    promiseOptional(
      'can nullify the response by returning null',
      null,
      function (returnValue, nullValue) {
        var targetMw = function (req, res, endWith) {
          return returnValue;
        };

        middleware.push(initialMw, targetMw, spyMw);

        worker.onFetch(evt);

        return evt.onceFinished.then(function () {
          expect(spyMw.calledOnce).to.be.true;
          expect(spyMw.calledWith(initialRequest, nullValue)).to.be.true;
        });
      }
    );

    it('can end the chain of middlewares abruptly', function () {
      var finalResponse = new Response('final');
      var targetMw = function (req, res, endWith) {
        return endWith(finalResponse);
      };

      middleware.push(initialMw, targetMw, spyMw);

      worker.onFetch(evt);

      return evt.onceFinished.then(function (responseAnswered) {
        expect(spyMw.called).to.be.false;
        expect(responseAnswered).to.equal(finalResponse);
      });
    });

    // XXX: WDYT? I'm not sure and maybe it's a risk and could lead to strange
    // behaviours.
    xit('can end the chain of middlewares abruptly (no need of return)',
    function () {
      var finalResponse = new Response('final');
      var targetMw = function (req, res, endWith) {
        endWith(finalResponse);
      };

      middleware.push(initialMw, targetMw, spyMw);

      worker.onFetch(evt);

      return evt.onceFinished.then(function (responseAnswered) {
        expect(spyMw.called).to.be.false;
        expect(responseAnswered).to.equal(finalResponse);
      });
    });

    describe('middleware decorators', function () {
      it('stopAfter() makes the chain to be interrupted after the middleware',
      function () {
        var decorators = ServiceWorkerWare.decorators || {};
        expect(decorators.stopAfter).to.exist;

        var stopAfter = decorators.stopAfter;
        var targetMw = stopAfter(function (req, res, endWith) { });
        middleware.push(initialMw, targetMw, spyMw);

        worker.onFetch(evt);

        return evt.onceFinished.then(function (responseAnswered) {
          expect(spyMw.called).to.be.false;
          expect(responseAnswered).to.equal(initialResponse);
        });
      });

      it('ifNoResponse() makes the middleware to work only if no response',
      function () {
        var decorators = ServiceWorkerWare.decorators || {};
        expect(decorators.ifNoResponse).to.exist;

        var ifNoResponse = decorators.ifNoResponse;
        var targetMw = ifNoResponse(function (req, res, endWith) {
          return Promise.resolve([null, null]);
        });
        middleware.push(initialMw, targetMw, spyMw);

        worker.onFetch(evt);

        return evt.onceFinished.then(function (responseAnswered) {
          expect(spyMw.calledOnce).to.be.true;
          expect(spyMw.calledWith(initialRequest, initialResponse)).to.be.true;
        });
      });
    });
  });

});
