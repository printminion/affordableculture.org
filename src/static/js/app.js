'use strict';

var app = angular.module('affordableCulture', ['ngRoute', 'affordableCulture.services', 'affordableCulture.directives', 'affordableCulture.filters']);

app.config(function ($routeProvider) {
    $routeProvider
        .when('/search/:search/:location/:data', {
            //controller: 'MessageListController',
            //templateUrl: 'partials/messages.html'
            action: "search"
        })
        .when('myCarousel', {

        })
        .when('#myCarousel', {

        })
        .when('%2Fsearch%2F:search', {
            action: "search"
        })
        .otherwise({
            //    redirectTo: '/messages'
        });
});