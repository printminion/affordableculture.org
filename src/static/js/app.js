'use strict';

angular.module('photoHunt',
    ['photoHunt.services', 'photoHunt.directives', 'photoHunt.filters'],
    function($locationProvider) {
      $locationProvider.html5Mode(true);
    }
);