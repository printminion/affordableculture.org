'use strict';

angular.module('affordableCulture',
    ['affordableCulture.services', 'affordableCulture.directives', 'affordableCulture.filters'],
    function($locationProvider) {
      $locationProvider.html5Mode(true);
    }
);