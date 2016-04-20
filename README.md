# ServiceWorkerWare

> An [Express](http://expressjs.com/)-like layer on top of `ServiceWorkers` to provide a way to easily plug functionality.

**Compatibility**

Currently working in:
- [Chrome](https://www.google.co.uk/chrome/browser/desktop/index.html)
- [Mozilla Nightly](https://blog.wanderview.com/sw-builds/)

## Philosophy

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


## Specifying routes

While registering your middlewares, you are not limited just to predefined paths, you have the choice to specify your routes by using *placeholders*. You could use placeholders as wildcards that match several different routes and handle them in your middleware registration. These placeholders are loosely based on [Express' path strings](http://expressjs.com/guide/routing.html#route-paths).

Currently supported placeholders include:

* Anonymous placeholder: `*`  
Can accommodate any number of characters (including the empty string):
  * `"*"` is the universal route -- it will match any path  
  ```javascript
worker.get('*'); // matches any path
```
  * `"/foo*"` will match `/foo` and any path downstream (like `/foo/bar/baz`)  
  ```javascript
worker.get('/foo*'); // will match /foo and any subpaths
```

* Named placeholder: `:<placeholder-name>`  
Can accommodate any substring, but doesn't allow the empty string (matches minimum 1 character).  
The placeholder name could be any number of alphanumeric characters:  
  * `"/:path"' will match `/foo` and `/foo/bar/baz`, but won't match `/`  
  ```javascript
worker.get('/:path'); // won't match / as :path must not be empty
```

You could use the backslash character to escape special placeholders (and specify literal asterisks and/or colon characters in your code). *Note: in JavaScript string literals you must double the backslash to achieve the intended effect.*

```javascript
worker.get('/:param\\:42'); // will match /x:42 and /answer/is:42
```


## Writing a middleware layer

Each middleware instance is an object implementing one callback per `ServiceWorker` event type to be handled:

```
{
    onInstall: fn1,
    onActivate: fn2,
    onFetch: fn3,
    onMessage: fn4
}
```

You don't need to respond to all the events--you can opt to only implement a subset of methods you care about. For example, if you only want to handle requests, you just need to implement the `onFetch` method. But in that case you might be missing out on the full `ServiceWorker` potential: you can do things such as preloading and caching resources during installation, clear the caches during activation (if the worker has been updated) or even just control the worker's behaviour by sending it a message.

Also, in order to make it even more Express-like, you can write middleware in the following way if you just want to handle fetch events and don't care about the ServiceWorkers life cycle:

```javascript
var worker = new self.ServiceWorkerWare();
worker.get('/hello.html', function(request, response) {
  return Promise.resolve(new Response('Hello world!', { headers: {'Content-Type': 'text/html'} }));
}
worker.init();
```

## Advanced middleware pipelining

Middlewares are tied to one or several URLs and executed in the same order you register them. The first middleware is passed with the Request from the client code and `null` as response. Next middlewares receive their parameters from the previous ones according to:

  * If returning a pair `[Request, Response]`, these will be the values for next request and response parameters.
  * If returning only a `Request`, this will be the next request and the response remains the same as for the previous middleware.
  * The same happens if returning only a `Response`.
  * For backward-compatibility, returning `null` will set the next Response to `null`.
  * Returning any other thing from a middleware will fail and cause a rejection.

Finally, the answer from the service worker will be the response returned by the last middleware.

If you need to perform asynchronous operations, instead of returning one of the previous values, you can return a Promise resolving in one of the previous values.

### Interrupting the middleware pipeline

If you want to respond from a middleware immediately and prevent other middlewares to be executed, return the response you want to use wrapped inside the `endWith()` callback. The callback is received as the third parameter of a middleware and expects a mandatory parameter to be the final response.

```javascript
var worker = new self.ServiceWorkerWare();
worker.use(function (req, res, endWith) {
  return endWith(
    new Response('Hello world!', { headers: {'Content-Type': 'text/html'} });
  );
});
worker.use(function (req, res, endWith) {
  console.log('Hello!'); // this will be never printed
});
worker.init();
```

Remember you can use promises resolving to the wrapped response for your asynchronous stuff.

## Events

### `onInstall`

It will be called during ServiceWorker installation. This happens just once.

### `onActivate`

It will be called just after `onInstall`, or each time that you update your ServiceWorker. It's useful to update caches or any part of your application logic.

### `onFetch(request, response)` returns Promise

Will be called whenever the browser requests a resource when the worker has been installed.

* `request`: it's a standard [Request Object](https://fetch.spec.whatwg.org/#concept-request)
* `response`: it's a standard [Response Object](https://fetch.spec.whatwg.org/#concept-response)

You need to `.clone()` the `request` before using it as some fields are one use only.

After the whole process of iterating over the different middleware you need to return a `Response` object. Each middleware can use the previous `response` object to perform operations over the content, headers or anything.

The `request` object provides details that define which resource was requested. This callback might (or not) use those details when building the `Response` object that it must return.

The following example will handle URLs that start with `virtual/` with the simplest version of `onFetch`: a callback! None of the requested resources need to physically exist, they will be programmatically created by the handler on demand:

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

The output for any request that hits this URL will be the original address of the URL, and a randomly generated number. Note how we can even specify the headers for our response!

Remember that the handler *must always return a Promise*.

### `onMessage(?)`

We will receive this event if an actor (window, iframe, another worker or shared worker) performs a `postMessage` on the ServiceWorker to communicate with it.

<!--

NOTE: These two events are commented out until the discussions are clarified

### `onBeforeEvicted(?)`

This is still under heavy discussion: it's a custom event that the User Agent sends to the worker to let it know that is going to be evicted.

### `onEvicted(?)`

Also under heavy discussion.

-->

## Middleware examples

This package already incorporates two simple middlewares. They are available by default when you import it:

TODO: I would suggest refactoring them away from this package

### `StaticCacher`

This will let you preload and cache static content during the `ServiceWorker` installation.

TODO: where does `self` come from? in which context is this being executed?

For example:

```
worker.use(new self.StaticCacher(['a.html', 'b.html' ...]));
```

Upon installation, this worker will load `a.html` and `b.html` and store their content in the default cache.

### `SimpleOfflineCache`

This will serve contents stored in the default cache. If it cannot find a resource in the cache, it will perform a fetch and save it to the cache.

### [<tt>ZipCacher</tt>](https://github.com/arcturus/zipcacher)

This is not built-in with this library. It enables you to specify a ZIP file to cache your resources from.

```javascript
importScripts('./sww.js');
importScripts('./zipcacher.js');

var worker = new self.ServiceWorkerWare();

worker.use(new ZipCacher('http://localhost:8000/demo/resources.zip'));
worker.use(new self.SimpleOfflineCache());
worker.init();
```

## Running the demo

Clone the repository, and then cd to the directory and run:

```
npm install
gulp webserver
```

TODO: use npm scripts to run gulp, avoid global gulp installation

And go to `http://localhost:8000/demo/index.html` using any of the browsers where `ServiceWorker`s are supported.

When you visit `index.html` the ServiceWorker will be installed and `/demo/a.html` will be preloaded and cached. In contrast, `/demo/b.html` will be cached only once it is visited (i.e. only once the user navigates to it).

For an example of more advanced programmatic functionality, you can also navigate to any URL of the form `http://localhost:8000/demo/virtual/<anything>` (where `anything` is any content you want to enter) and you'll receive an answer by the installed virtual URL handler middleware.

# And what about testing?
We are working on an you can see the specs under `lib/spec` folder.

Please, launch:
```bash
$ gulp tests
```

Once tests are complete, [Karma](http://karma-runner.github.io/0.12/index.html), the testing framework, keeps monitoring your files to relaunch the tests when something is modified. Do not try to close the browsers. If you want to stop testing, kill the Karma process.

This should be straightforward for Windows and iOS. As usual, if your are on Linux or you're having problems with binary routes, try setting some environment variables:
```bash
$ FIREFOX_NIGHTLY_BIN=/path/to/nightly-bin CHROME_BIN=/path/to/chrome-bin gulp tests
```

## Thanks!

A lot of this code has been inspired by different projects:

- [Firefox OS V3 Architecture] (https://github.com/fxos/contacts)
- [Shed] (https://github.com/wibblymat/shed)
- [sw-precache](https://github.com/jeffposnick/sw-precache)
- [offliner](https://github.com/lodr/offliner)

## License

Mozilla Public License 2.0

http://mozilla.org/MPL/2.0/
