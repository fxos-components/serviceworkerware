importScripts('/base/lib/spec/nodeMock.js');
importScripts('/base/lib/sww.js');
importScripts('/base/lib/router.js');

describe('ServiceWorkerWare', function () {
  'use strict';

  var worker;
  var request;

  var fallbackResult = 'fallbackMW';
  var fallbackMW = function(req, res) {
    return fallbackResult;
  }

  beforeEach(function() {
    worker = new ServiceWorkerWare();
    worker.init();
    request = {
      method: 'GET',
      url: 'https://www.example.com',
      clone: function() {}
    };
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
      worker.use(function(req, res) {
        return Promise.resolve('always');
      });

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
      worker.use(function(req, res) {
        return Promise.resolve(undefined);
      });

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
});
