'use strict';

angular.module('affordableCulture',
    ['affordableCulture.services', 'affordableCulture.directives', 'affordableCulture.filters'],
    function($routeProvider, $locationProvider) {
        console.log('location', $routeProvider, $locationProvider);

        $routeProvider.when('#!search/:search', {
        controller: AffordableCultureCtrl,
        resolve: {
              // I will cause a 1 second delay
              delay: function($q, $timeout) {
                console.log('delay');
                var delay = $q.defer();
                $timeout(delay.resolve, 1000);
                return delay.promise;
              }
            }
         });

      $locationProvider.html5Mode(true).hashPrefix('!');
    }
);