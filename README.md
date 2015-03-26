# Introduction

An express-like layer on top of ServiceWorkers to provide a way to easily plug functionality.

## Compatibility

Currently working in:
- [Chrome Canary](https://www.google.co.uk/chrome/browser/canary.html)
- [Mozilla Nightly](https://blog.wanderview.com/sw-builds/)

# Philosophy
Following the same pattern from the [Express](http://expressjs.com/) framework, we can write middleware to handle our requests, pipe them and build greater things.

But with ServiceWorkers, you can do more things than just attend requests. They have a lifecycle and are able to listen to events (via postMessage). This has been handle as well as part of the process, so your middleware can handle both the ServiceWorker lifecycle/events and requests.

## How I can use a middleware layer?
Simple we follow again the express syntax, so you can just use:

```
importScripts('../path/to/sww.js');
importScripts('../mymiddleware.js'); //Defines a variable mymiddleware

var worker = new self.ServiceWorkerWare();
worker.use(mymiddleware);
```

And that will allow your middleware to handle any requests.

Also, you can specify paths and http verbs like:

```
worker.post('/mypat/.*', mymiddleware);
```

## How I can write a middleware layer?
As we will be handling more than just request, our middleware consists of an object that will handle the ServiceWorker events that is:

```
{
    onInstall: fn1,
    onActivate: fn2,
    onFetch: fn3,
    onMessage: fn4,
    onBeforeevicted: fn5,
    onEvicted: fn6
}
```

Do we need to provide functionality to all the possible events? No, we just can write the methods that we want to handle. If we just want to handle requests, we just need to provide an object that handles the `onFetch` event.

Also as for making it more express-like, if you want to support just requests (nothing related to ServiceWorkers life cycle) you can write your middleware like this:

```
worker.get('/myResource.html', function(request, response) {
   // Your code goes here
   return Promise.resolve(response);
});
```

## Why would I like to support more than just handling requests?

Because we could be interested on doing things during ServiceWorker installation (like precaching resources), clear caches (during activation, if the ServiceWorker changed), or we just want to communicate sending messages. Remember at the end of the day we have code to handle request, and it could be interesting to vary the content of caches or even ServiceWorker behaviour at will with a message.

## Can I use more than one middleware combined?

Right, you can do it, take into account that the request/response objects will be passing through them sequentially in the order that we register our middleware objects.

## Handling requests

Ok, what do I have to write to handle a request? As you read before, either you provide an object that handles a callback for the function `onFetch` or you just write the callback itself.

You will receive two parameters, the first one is a [Request Object](https://fetch.spec.whatwg.org/#concept-request) and the second a [Response Object](https://fetch.spec.whatwg.org/#concept-response).
Remember to `.clone()` them to work with them.

The example below handles urls that start with `virtual/`. The amazing thing is that you don't need to have any physical file or directory to handle that request, we will programatically create the content returned by any request that hits that format:
```
worker.get('virtual/.', function(request, response) {
  var url = request.clone().url;

  var content = '<html><body>'
      + url + ' ' + Math.random()
      + '<br/><a href="/demo/index.html">index</a></body></html>';

  return Promise.resolve(new Response(content, {
    headers: {
      'Content-Type': 'text/html',
      'x-powered-by': 'ServiceWorkerWare'
    }
  }));
});
```

The output for any request that hits this url will be the original address of the url and a random number, with the headers that we specified in the response object.

One important point is the fact that when you write a handler for using in your request, the function handling those requests *must return a promise*.

## Can I see some examples of middleware?

Right we added 2 simple middlewares to this package, one for precaching static content and a simple offline cache handler. They are available by default when you import this library.

* StaticCacher: this will help you to specify any set of files to be cached during the ServiceWorker installation:
```
worker.use(new self.StaticCacher(['a.html', 'b.html' ...]));
```
It saves the content in the default cache.

* SimpleOfflineCache: will serve the contents of the default cache. Right now if it cannot find an element in the cache, it will perform a fetch and will save it to the cache.
(TODO: this should be configurable ;P)

### More examples of middleware
* [ZipCacher](https://github.com/arcturus/zipcacher) enables you to specify a zip file to cache your resources from.

# Demo

Please run:
```
npm install
gulp webserver
```

And go to http://localhost:8000/demo/index.html

You can see how the document `/demo/a.html` is precached (once the ServiceWorker is installed visiting index.html), and how the document `/demo/b.html` will be cached once visited.

Also some other tests that you can do, visit any `http://localhost:8000/demo/virtual/<anything>` you'll receive an answer by this virtual url handler.

# Thanks
A lot of this code has been written with the inspiration from different projects:
- [Firefox OS V3 Architecture] (https://github.com/fxos/contacts)
- [Shed] (https://github.com/wibblymat/shed)
- [sw-preache](https://github.com/jeffposnick/sw-precache)
- [offliner](https://github.com/lodr/offliner)
