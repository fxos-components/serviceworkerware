# Introduction

An [Express](http://expressjs.com/)-like layer in top of `ServiceWorkers` to provide a way to easily plug functionality.

## Compatibility

Currently working in:
- [Chrome Canary](https://www.google.co.uk/chrome/browser/canary.html)
- [Mozilla Nightly](https://blog.wanderview.com/sw-builds/)

# Philosophy

`ServiceWorkers` are sold as the replacement for `AppCache`. But you can do more things than just cache network requests! They have a lifecycle and are able to listen to events (via postMessage), so you can write advanced caches, routers, and a lot more of things and have them run on the ServiceWorker.

This library follows the same pattern as the Express framework, allowing developers to write individual *middleware* pieces that can be layered in order to augment the default functionality.

## Usage

Our syntax is pretty similar to Express'. The first step is to load the basic library:

```javascript
importScripts('../path/to/ServiceWorkerWare.js');
```

Then you can load as many additional layers as you might need. In this example we will just import one:

```javascript
 // Defines a `myMiddleware` variable
importScripts('../myMiddleware.js');
```

Once `myMiddleware` is loaded, you can `use` it with `ServiceWorkerWare` instances:

```javascript
var worker = new self.ServiceWorkerWare();
worker.use(myMiddleware);
```

And that will route the requests through `myMiddleware`.

You can also specify paths and HTTP verbs, so only requests that match the path or the verb will be handled by that middleware. For example:

```javascript
worker.post('/event/*', analyticsMiddleware);
```

More than one middleware can be registered with one worker. You just need to keep in mind that the `request` and `response` objects will be passed to each middleware in the same order that they were registered.


## Writing a middleware layer

Each middleware is defined by an object containing a number of callbacks that will handle the ServiceWorker events:

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

You don't need to respond to all the events--you can opt to only implement a subset of methods you care about. For example, if you just want to handle requests, you just need to implement the `onFetch` method. But in that case you might be missing out on the full `ServiceWorker` potential: you can do things such as preloading and caching resources during installation, clear the caches during activation (if the worker has been updated) or even just control the worker's behaviour by sending it a message.

Also, in order to make it even more Express-like, you can write middleware in the following way if you just want to handle requests and don't care about the ServiceWorkers life cycle:

```
worker.get('/myResource.html', function(request, response) {
   // Your code goes here
   return Promise.resolve(response);
});
```

## Handling requests

Ok, what do I have to write to handle a request? As you read before either you provide an object that handles a callback for the function `onFetch` or you just write the callback itself.

You will receive two parameteres, the first one is a [Request Object](https://fetch.spec.whatwg.org/#concept-request) and the second a [Response Object](https://fetch.spec.whatwg.org/#concept-response).
Remember to `.clone()` them to work with them.

The example below handlers urls that start with `virtual/`, the amazing thing, you don't need to have any phisical file or directory to handle that request, we will programatically create the content returned by any request that hits that format:
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

* SimpleOfflineCache: will serve the contents of the default cache. Right now if it cannot find an element in the cache will perform a fetch and will save it to the cache.
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
