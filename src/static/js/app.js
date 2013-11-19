'use strict';

angular.module('affordableCulture',
    ['affordableCulture.services', 'affordableCulture.directives', 'affordableCulture.filters'],
    function($routeProvider, $locationProvider) {
        console.log('location', $routeProvider, $locationProvider);

        $routeProvider
            .when('/search/:search', {
            action: "contact.form"
         })
            .when('myCarousel', {
         })
            .when('#myCarousel', {
         })
            .when('%2Fsearch%2F:search', {
            action: "contact.form"
         })

            .otherwise({
         });

      $locationProvider.html5Mode(true).hashPrefix('!');
    }
);