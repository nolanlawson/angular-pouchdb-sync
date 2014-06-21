'use strict';

function zpad(i) {
  i = i.toString();
  while (i.length < 20) {
    i = '0' + i;
  }
  return i;
}

function cleanDoc(doc) {
  var res = JSON.parse(JSON.stringify(doc));
  delete res.$$hashKey;
  return res;
}

angular.module('pouch', [])
    .directive('pouchPersist', ['$parse', '$animate', '$rootScope', function($parse, $animate, $rootScope) {
  var IGNORE = "$$ignore";
  var MODIFICATION_DELAY = 1000;

  var idCounter = 0;
  var idIncrement = Math.floor(Math.random() * 10000);

  return {
    priority: 100000,
    link: function($scope, $element, $attr){
      var expression = $attr.ngRepeat;
      var idField = $attr.pouchId;
      var sync = $attr.pouchSync;
      var match = expression.match(/^\s*([\s\S]+?)\s+in\s+([\s\S]+?)(?:\s+track\s+by\s+([\s\S]+?))?\s*$/);
      var collection = match[2];
      var collectionArray;
      var pouch = new PouchDB(collection);
      if (sync) {
        pouch.sync(sync, {live: true}).on('uptodate', function () {
          console.log('uptodate');
          initialize();
        });
      }

      function initialize() {
        console.log('initialize');
        pouch.allDocs({include_docs: true}).then(function (res) {
          // all docs done
          console.log("all docs done, length is: " + res.rows.length);
          if (!res.rows.length) {
            return;
          }

          $rootScope.$apply(function () {
            var modified = false;
            res.rows.forEach(function (row, i) {
              if (i > collectionArray.length) {
                collectionArray.push(row.doc);
                modified = true;
              } else if (!angular.equals(row.doc, collectionArray[i])) {
                collectionArray[i] = row.doc;
                modified = true;
              }
            });
            while (res.rows.length < collectionArray.length) {
              collectionArray.pop();
              modified = true;
            }
            if (modified) {
              collectionArray[IGNORE] = true;
            }
          });
        });
      }

      var modificationQueue = {};

      $scope.$watch(collection, function (newValue, oldValue) {
        collectionArray = newValue;
        console.log('deep newValue: ' + JSON.stringify(newValue));
        console.log('deep oldValue: ' + JSON.stringify(oldValue));

        if (newValue.length === 0 && oldValue.length === 0) {
          // initialize
          console.log('initialize');
          initialize();
        } else if (newValue[IGNORE]) {
          // change made by us, ignore
          delete newValue[IGNORE];
          console.log('change made by us, ignoring');
        } else if (newValue.length > oldValue.length) {
          // insertion
          console.log('insertion');
          newValue.forEach(function (element, i) {
            if (!element._id) {
              // this is the new one
              if (idField) {
                element._id = element[idField];
              } else { // insert using incrementing id to maintain order
                // ensure we insert at the very end
                newValue.forEach(function (otherElement) {
                  var idAsInt;
                  try {
                    idAsInt = parseInt(otherElement._id, 10);
                    if (idAsInt > idCounter) {
                      idCounter = idAsInt;
                    }
                  } catch (err) { /* ignore */ }
                });
                idCounter += idIncrement;
                element._id = zpad(idCounter)
              }
            }
            console.log('putting');
            pouch.put(cleanDoc(element)).then(function (res) {
              console.log('done putting');
              $rootScope.$apply(function () {
                element._rev = res.rev;
                newValue[IGNORE] = true;
              });
            });
          });
        } else if (newValue.length < oldValue.length) {
          // deletion
          console.log('deletion');
          var ids = {};
          newValue.forEach(function (element) {
            ids[element._id] = true;
          });
          oldValue.forEach(function (element) {
            if (!ids[element._id]) {
              // this is the deleted one
              element._deleted = true;
              pouch.put(cleanDoc(element)).then(function (res) {
                $rootScope.$apply(function () {
                  element._rev = res.rev;
                });
              });
            }
          });
        } else {
          // modification of some single value
          console.log('something else');
          oldValue.forEach(function (oldElement, i) {
            var newElement = newValue[i];
            if (!angular.equals(oldElement, newElement)) {
              // this is the modified one

              if (modificationQueue[newElement._id]) {
                clearTimeout(modificationQueue[newElement._id]);
              }
              modificationQueue[newElement._id] = setTimeout(function () {
                delete modificationQueue[newElement._id];
                console.log('making change to id: ' + newElement._id);
                pouch.put(cleanDoc(newElement)).then(function (res) {
                  $rootScope.$apply(function () {
                    newElement._rev = res.rev;
                    newValue[IGNORE] = true;
                  });
                });
              }, MODIFICATION_DELAY);
            }
          });
        }

      }, true);
    }
  };
}]);