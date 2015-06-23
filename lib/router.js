'use strict';

// Inspired by expressjs and shed (https://github.com/wibblymat/shed)
function Router(options) {
  this.options = options;
  this.stack = [];
}

Router.prototype.ALL_METHODS = 'all';
Router.prototype.methods = ['get', 'post', 'put', 'delete', 'head',
  Router.prototype.ALL_METHODS];

/**
 * Add a new route to the stack.
 * @param method (String) http verb to handle the request
 * @param path (Regexp) string or regexp to match urls
 * @param handler (Function) payload to be executed if url matches.
 */
Router.prototype.add = function r_add(method, path, handler) {
  var pathRegexAndTags, pathRegex, namedPlaceholders;

  method = this._sanitizeMethod(method);

  // Parse simle string path into regular expression for path matching
  pathRegexAndTags = this._parseSimplePath(path);
  pathRegex = pathRegexAndTags.regexp;
  namedPlaceholders = pathRegexAndTags.tags;

  this.stack.push({
    method: method,
    path: pathRegex,
    namedPlaceholders: namedPlaceholders,
    handler: handler
  });
};

/**
 * Create the utility methods .get .post ... etc.
 */
Router.prototype.methods.forEach(function(method) {
  Router.prototype[method] = function(path, handler) {
    return this.add(method, path, handler);
  };
});

Router.prototype.proxyMethods = function r_proxyPrototype(obj) {
  var self = this;
  this.methods.forEach(function(method) {
    obj[method] = function(path, mw) {
      if (typeof mw.onFetch !== 'function' && typeof mw !== 'function') {
        throw new Error('This middleware cannot handle fetch request');
      }
      var handler = typeof mw.onFetch !== 'undefined' ?
        mw.onFetch.bind(mw) : mw;
      self.add(method, path, handler);
    };
  });
};

/**
 * Matches the given url and methods with the routes stored in
 * the stack.
 */
Router.prototype.match = function r_match(method, url) {
  method = this._sanitizeMethod(method);
  var matches = [];

  var _this = this;
  this.stack.forEach(function eachRoute(route) {
    if (!(method === route.method || route.method === _this.ALL_METHODS)) {
      return;
    }

    var groups = _this._routeMatch(url, route);
    if (groups) {
      route.handler.__params = groups;
      matches.push(route.handler);
    }
  });

  return matches;
};

/**
 * Performs a matching test for url against a route.
 * @param {String} the url to test
 * @param {route} the route to match against
 * @return {Object} an object with the portions of the url matching the named
 * placeholders or null if there is no match.
 */
Router.prototype._routeMatch = function (url, route) {
  var groups = url.match(route.path);
  if (!groups) { return null; }
  return this._mapParameters(groups, route.namedPlaceholders);
};

/**
 * Assign names from named placeholders in a route to the matching groups
 * for an URL against that route.
 * @param {Array} groups from a successful match
 * @param {Array} names for those groups
 * @return a map of names of named placeholders and values for those matches.
 */
Router.prototype._mapParameters = function (groups, placeholderNames) {
  return placeholderNames.reduce(function (params, name, index) {
    params[name] = groups[index + 1];
    return params;
  }, Object.create(null));
};

Router.prototype._sanitizeMethod = function(method) {
  var sanitizedMethod = method.toLowerCase().trim();
  if (this.methods.indexOf(sanitizedMethod) === -1) {
    throw new Error('Method "' + method + '" is not supported');
  }
  return sanitizedMethod;
};

/**
 * Simple path-to-regex translation based on the Express "string-based path"
 * syntax.
 */
Router.prototype._parseSimplePath = function(path) {
  // Check for named placeholder crowding
  if (/\:[a-zA-Z0-9]+\:[a-zA-Z0-9]+/g.test(path)) {
    throw new Error('Invalid usage of named placeholders');
  }

  // Check for mixed placeholder crowdings
  var mixedPlaceHolders =
    /(\*\:[a-zA-Z0-9]+)|(\:[a-zA-Z0-9]+\:[a-zA-Z0-9]+)|(\:[a-zA-Z0-9]+\*)/g;
  if (mixedPlaceHolders.test(path.replace(/\\\*/g,''))) {
    throw new Error('Invalid usage of named placeholders');
  }

  // Try parsing the string and converting special characters into regex
  try {
    // Parsing anonymous placeholders with simple backslash-escapes
    path = path.replace(/(.|^)[*]+/g, function(m,escape) {
      return escape==='\\' ? '\\*' : (escape+'(?:.*?)');
    });

    // Parsing named placeholders with backslash-escapes
    var tags = [];
    path = path.replace(/(.|^)\:([a-zA-Z0-9]+)/g, function (m, escape, tag) {
      if (escape === '\\') { return ':' + tag; }
      tags.push(tag);
      return escape + '(.+?)';
    });

    return { regexp: RegExp(path + '$'), tags: tags };
  }

  // Failed to parse final path as a RegExp
  catch (ex) {
    throw new Error('Invalid path specified');
  }
};


module.exports = Router;
