//importScripts('../lib/sww.js');
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

worker.use(SimpleWare);
worker.use(new self.StaticCacher(['a.html']));
worker.use(new self.SimpleOfflineCache());
worker.init();
