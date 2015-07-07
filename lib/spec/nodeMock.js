self.module = self.module || {};
self.require = self.require || function (path) {
  'use strict';
  return self.require.mocks[path];
};
self.require.mocks = self.require.mocks || {};
