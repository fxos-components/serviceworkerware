importScripts('../dist/sww.0.0.0.min.js');

var worker = new self.ServiceWorkerWare();

var SimpleWare = {
  onInstall: function() {
    console.log('On install');
    return Promise.resolve();
  },
  onActivate: function(evt) {
    console.log('On activate called!!');
  },
  onMessage: function(evt) {
    console.log('On message called!!');
  }
};

// Simple middleware that just listen to SW livecycle events
worker.use(SimpleWare);

// We precache known resources with the StaticCacher middleware
worker.use(new self.StaticCacher(['a.html']));

// Middleware example for handling 'virtual' urls and building the
// response with js.
worker.get('virtual/.', function(request, response) {
  var url = request.clone().url;

  var content = '<html><body>'
      + url + ' ' + Math.random()
      + '<br/><a href="/demo/index.html">index</a></body></html>';

  return Promise.resolve(new Response(content, {
    headers: {
      'Content-Type': 'text/html'
    }
  }));
});

// Handles offline resources saved by the StaticCacher middleware,
// also caches those resources not in the cache for next visit
worker.use(new self.SimpleOfflineCache());
worker.init();
