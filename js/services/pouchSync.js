angular.module('pouch', []).service('pouchSync', [function() {

  function PouchSync() {
    this.queue = [];
  }

  return new PouchSync();
}]);