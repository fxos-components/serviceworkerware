importScripts('/base/lib/spec/nodeMock.js');
importScripts('/base/lib/sww.js');
importScripts('/base/lib/router.js');

describe('ServiceWorkerWare', function () {
  'use strict';

  var worker;
  var request;

  var fallbackMW = function(req, res) {
    if (res !== null) {
      return Promise.resovle(res);
    }

    return 'fallbackMW';
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
      var stub = sinon.stub(self, 'fetch', function() {
        return Promise.resolve(result);
      });

      worker.onFetch({request: request}).then(function(response) {
        expect(stub.called).to.be.true;
        expect(response).to.equal(result);
        stub.restore();
        done();
      }).catch(function(err) {
        stub.restore();
        done(new Error(err));
      });
    });

    it('should use fallback middleware if defined', function(done) {
      worker = new ServiceWorkerWare(fallbackMW);

      var spy = sinon.spy(self, 'fetch');

      worker.onFetch({
          request: request,
          respondWith: function(result) {
            result.then(function(res) {
              expect(spy.called).to.be.false;
              expect(res).to.equal('fallbackMW');
              spy.restore();
              done();
            }).catch(function(err) {
              spy.restore();
              done(new Error(err));
            })
          }
      });
    });

  });

});
