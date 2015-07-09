
(function (global) {
  'use strict';

  var installed;

  /**
   * This class is no more than an event dispatcher but allowing you to
   * mock or intercept events in the global object. Usefull for capturing
   * and mocking install, activate, message, fetch... events.
   *
   * To start intercepting the global object, you must call `installGlobaly()`.
   * If you want to stop intercepting, call `uninstall()`. This method won't
   * clear the listener already installed, it only stop intercepting the global
   * object. To remove all listeners use `clearListeners()` method.
   *
   * @param {Array<String>} events to intercept.
   */
  function GlobalEventsMock(types) {
    this._listeners = {};
    this._eventTypes = types;
    this.clearListeners();
  }

  /**
   * Dispatch an event. If the object is installed, it calls the method
   * on<event> from the global object as well.
   *
   * @param {String} the type of event to dispatch.
   * @param {Object} the data for the event.
   * @param {Bool} indicates if the object is extendable. If so, the event is
   * enriched with the `waitUntil()` method.
   * @return {Promise<>} resolved immediately or, for extendable events, when
   * the promise passed to `waitUntil` is resolved.
   */
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

  /**
   * Dispatch and extendable event. Extendable events has the method
   * `waitUntil()`.
   *
   * @param {String} the type of event to dispatch.
   * @param {Object} the data for the event.
   * @return {Promise<>} resolved when the promise passed to `waitUntil()` is
   * resolved.
   */
  GlobalEventsMock.prototype.emitExtendable = function (type, data) {
    return this.emit(type, data, true);
  };

  /**
   * Adds a listener to a type of event.
   *
   * @param {String} the type of the event.
   * @param {Listener} the function or object to be the handler.
   */
  GlobalEventsMock.prototype.on = function (type, listener) {
    if (this._listeners[type].indexOf(listener) < 0) {
      this._listeners[type].push(listener);
    }
  };

  /**
   * Removes a handler for an event.
   *
   * @param {String} the type of the event.
   * @param {Listener} the handler function or object.
   */
  GlobalEventsMock.prototype.off = function (type, listener) {
    var index = this._listeners[type].indexOf(listener);
    if (index >= 0) { this._listeners[type].splice(index, 1); }
  };

  /**
   * Start intercepting dispatching on the global object by hickjacking
   * globals `addEventListener()`, `removeEventListener()` and `on<event>`
   * properties.
   *
   * @throw {Error} if attemping to install a GlobalEventsMock instance while
   * other is already installed.
   */
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

  /**
   * Stop intercepting dispatching on the global object by restoring the former
   * values of globals `addEventListener()`, `removeEventListener()` and
   * `on<event>` properties.
   */
  GlobalEventsMock.prototype.uninstall = function () {
    if (!installed || installed !== this) { return; }
    this._restoreOriginals();
    installed = null;
  };

  /**
   * Remove all listeners from all event types of for those passed as
   * parameters. You can pass nothing, an event type or an array of events.
   *
   * @param {String or Array<String>} optional - event type to be clear of
   * listeners.
   */
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
