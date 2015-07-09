
(function (global) {
  'use strict';

  var installed;

  function GlobalEventsMock(types) {
    this._listeners = {};
    this._eventTypes = types;
    this.clearListeners();
  }

  GlobalEventsMock.prototype.emit = function (type, data, isExtendable) {
    data = data || {};
    data.type = type;

    var fulfillPromise;
    var done = new Promise(function (fulfill) {
      fulfillPromise = fulfill;
    });

    if (isExtendable) {
      data.waitUntil = function (promise) {
        return promise.then(fulfillPromise);
      };
    }
    else {
      fulfillPromise();
    }

    this._dispatch(this._listeners[type], data);
    if (installed) {
      var name = 'on' + type;
      if (typeof global[name] === 'function') { global[name](data); }
    }

    return done;
  };

  GlobalEventsMock.prototype.emitExtendable = function (type, data) {
    return this.emit(type, data, true);
  };

  GlobalEventsMock.prototype.on = function (type, listener) {
    if (this._listeners[type].indexOf(listener) < 0) {
      this._listeners[type].push(listener);
    }
  };

  GlobalEventsMock.prototype.off = function (type, listener) {
    var index = this._listeners[type].indexOf(listener);
    if (index >= 0) { this._listeners[type].splice(index, 1); }
  };

  GlobalEventsMock.prototype.installGlobaly = function () {
    if (installed === this) { return; }
    if (installed) {
      throw new Error(
        'Other interceptor has been installed. Call `uninstall()` on that ' +
        'interceptor first.'
      );
    }
    this._saveOriginals();
    this._install();
    installed = this;
  };

  GlobalEventsMock.prototype.uninstall = function () {
    if (!installed || installed !== this) { return; }
    this._restoreOriginals();
    installed = null;
  };

  GlobalEventsMock.prototype.clearListeners = function (evtTypes) {
    var _this = this;
    if (!Array.isArray(evtTypes)) {
      evtTypes = evtTypes ? [evtTypes] : _this._eventTypes;
    }
    evtTypes.forEach(function (type) { _this._listeners[type] = []; });
  };

  GlobalEventsMock.prototype._dispatch = function (listeners, data) {
    listeners.forEach(function (listener) {
      if (listener.handleEvent) {
        listener = listener.handleEvent.bind(listener);
      }
      if (typeof listener === 'function') {
        listener(data);
      }
    });
  };

  GlobalEventsMock.prototype._saveOriginals = function () {
    var _this = this;
    _this._originalContext = Object.create(null);
    _this._originalContext.addEventListener = global.addEventListener;
    _this._originalContext.removeEventListener = global.removeEventListener;

    // on<event> global handlers
    _this._eventTypes.forEach(function (type) {
      var name = 'on' + type;
      _this._originalContext[name] = global[name];
    });
  };

  GlobalEventsMock.prototype._install = function () {
    global.addEventListener = this.on.bind(this);
    global.removeEventListener = this.off.bind(this);

    // on<event> global handlers
    this._eventTypes.forEach(function (type) {
      var name = 'on' + type;
      global[name] = null;
    });
  };

  GlobalEventsMock.prototype._restoreOriginals = function () {
    var _this = this;
    Object.keys(_this._originalContext).forEach(function (property) {
      global[property] = _this._originalContext[property];
    });
  };

  global.GlobalEventsMock = GlobalEventsMock;
}(this));
