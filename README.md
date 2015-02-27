# ServiceWorkerWare

An express like layer in top of ServiceWorkers to provide a way to easily plug functionality.

## Compatibility

Currently working in:
- [Chrome Canary](https://www.google.co.uk/chrome/browser/canary.html)
- [Mozilla Nightly](https://blog.wanderview.com/sw-builds/)

## Philosophy
Following the same pattern than express framework, we can write middleware to handle our request, pipe them and build greater things.

We added 2 simple middlewares, one for precaching static content and a simple offline cache handler.

The noticeable difference with express middleware is that the middleware layer can also handle ServiceWorke life cycle events.

## Demo

Please run:
```
npm install
gulp webserver
```

And go to http://localhost:8000/demo/index.html

## Thanks
A lot of this code has been written with the inspiration from different projects:
- [Firefox OS V3 Architecture] (https://github.com/fxos/contacts)
- [Shed] (https://github.com/wibblymat/shed)
- [sw-preache](https://github.com/jeffposnick/sw-precache)
- [offliner](https://github.com/lodr/offliner)