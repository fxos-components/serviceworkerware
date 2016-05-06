importScripts('../dist/sww.js');

var worker = new self.ServiceWorkerWare();

// Simple middleware that just listen to SW livecycle events,
// it wont handle any request.
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

worker.use(SimpleWare);

// We precache known resources with the StaticCacher middleware
worker.use(new self.StaticCacher(['a.html']));

// Middleware example for handling 'virtual' urls and building the
// response with js.
worker.get('virtual/*', function(request, response) {
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

function updateHeaders(origHeaders) {
  var headers = new Headers();
  for(var kv of origHeaders.entries()) {
    headers.append(kv[0], kv[1]);
  }

  headers.append('X-Powered-By', 'HTML5 ServiceWorkers FTW');
  return headers;
}

// Handles offline resources saved by the StaticCacher middleware,
// also caches those resources not in the cache for next visit
worker.use(new self.SimpleOfflineCache());
worker.use(function(request, response) {
  // Add an X-Powered-By header to all responses. We have to manually
  // clone the response in order to modify the headers, see:
  // http://stackoverflow.com/questions/35421179/how-to-alter-the-headers-of-a-response
  return new Promise(function(resolve) {
    return response.blob().then(function(blob) {
      resolve(new Response(blob, {
        status: response.status,
        statusText: response.statusText,
        headers: updateHeaders(response.headers)
      }));
    });
  });
});
worker.init();
