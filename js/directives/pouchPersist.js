angular.module('pouch', [])
    .directive('pouchPersist', ['$parse', '$animate', function($parse, $animate) {
  var IGNORE = '$$hashKey';
  return {
    priority: 100000,
    link: function($scope, $element, $attr, ctrl, $transclude){
      var expression = $attr.ngRepeat;
      var match = expression.match(/^\s*([\s\S]+?)\s+in\s+([\s\S]+?)(?:\s+track\s+by\s+([\s\S]+?))?\s*$/);
      var rhs = match[2];

      $scope.$watchCollection(rhs, function (newValue, oldValue) {
        console.log('newValue: ' + JSON.stringify(newValue));
        console.log('oldValue: ' + JSON.stringify(oldValue));
      });

      $scope.$watch(rhs, function (newValue, oldValue) {
        console.log('deep newValue: ' + JSON.stringify(newValue));
        console.log('deep oldValue: ' + JSON.stringify(oldValue));
      }, true);
    }
  };
}]);