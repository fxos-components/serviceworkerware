self.module = self.module || {};
self.require = self.require || function (path) {
  return self.require.mocks[path];
};
self.require.mocks = self.require.mocks || {};
