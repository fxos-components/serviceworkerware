'use strict';

var CacheHelper = require('./cachehelper');

function StaticCacher(fileList) {
  if (!Array.isArray(fileList) || fileList.length === 0) {
    throw new Error('Invalid file list');
  }
  this.files = fileList;
}

StaticCacher.prototype.onInstall = function sc_onInstall() {
  var self = this;
  return CacheHelper.getDefaultCache().then(function(cache) {
    return CacheHelper.addAll(cache, self.files);
  });
};

module.exports = StaticCacher;
