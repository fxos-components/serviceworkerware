ServiceWorkerWare debugging
===========================

## Debug build

By default the build script in `gulp` will strip the debugging information. To get a version that will include all debug information and performance measures, please run the following command:

```bash
gulp debug
```

That will create a the following file:

```
./dist/sww.js
```

With all the debugging options that we are adding.


##Performance debugging

If you take a look to the code, you will see how in some places we are using the [Performance Timing API](https://developer.mozilla.org/en-US/docs/Web/API/Performance/timing), available in *Firefox Nightly*.


We have introduced some marks that will be useful in your script to complete other measures.

The philosophy behind this is to provide some marks at the begining of the events triggered by the *ServiceWorker* so later you can create more marks and measures in your specific middlwares.

### Performance marks
#### sww_parsed
Marks when the javascript file containing the library has been parsed.

#### event_[install|fetch|activate]_start
Mark setup when the *ServiceWorker* receives one of those events.

#### event_[install|fetch|activate]_end
This mark is setup when the method that process the event finish. Take into account that doesn't mean we have the result.

#### soc_[url]
Specific mark for the `SimpleOfflineCache` middleware that is setup when a request goues through this middleware.

#### soc_cache_[url]
Specific mark for the `SimpleOfflineCache` middleware, setup once that we did query the database associated to this middleware.

#### soc_cache_hit_[url]
As well this mark is associated to the `SimpleOfflineCache`. We will have it if we have a hit on the offline cache.
