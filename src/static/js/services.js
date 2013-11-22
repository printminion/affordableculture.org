'use strict';

angular.module('affordableCulture.services', [])
    .factory('Conf', function($location) {
      function getRootUrl() {
        var rootUrl = $location.protocol() + '://' + $location.host();
        if ($location.port())
          rootUrl += ':' + $location.port();
        return rootUrl;
      }
      return {
        'clientId': '538920374889.apps.googleusercontent.com',
        'apiBase': '/api/',
        'rootUrl': getRootUrl(),
        'scopes': 'https://www.googleapis.com/auth/plus.login ',
        'requestvisibleactions': 'http://schemas.google.com/AddActivity ' +
                'http://schemas.google.com/ReviewActivity',
        'cookiepolicy': 'single_host_origin'
      };
    })
    .factory('AffordableCultureApi', function($http, Conf) {
      return {
        signIn: function(authResult) {
          return $http.post(Conf.apiBase + 'connect', authResult);
        },
        voteAttractionBeenThere: function(attractionId) {
          return $http.put(Conf.apiBase + 'votes',
              {'attractionId': attractionId, 'vote': 'beenThere'});
        },
        voteAttractionWantToGo: function(attractionId) {
          return $http.put(Conf.apiBase + 'votes',
              {'attractionId': attractionId, 'vote': 'wantToGo'});
        },
        getCategories: function() {
          return $http.get(Conf.apiBase + 'categories');
        },
        getUploadUrl: function() {
          return $http.post(Conf.apiBase + 'images');
        },
        getAllAttractionsByCategory: function(categoryId) {
          return $http.get(Conf.apiBase + 'attractions',
              {params: {'categoryId': categoryId}});
        },
        getAttraction: function(attractionId) {
          return $http.get(Conf.apiBase + 'attractions', {params:
              {'attractionId': attractionId}});
        },
        getUserAttractionsByCategory: function(categoryId) {
          return $http.get(Conf.apiBase + 'attractions', {params:
              {'categoryId': categoryId, 'userId': 'me'}});
        },
        getFriends: function () {
          return $http.get(Conf.apiBase + 'friends');
        },
        getFriendsAttractionsByCategory: function(categoryId) {
          return $http.get(Conf.apiBase + 'attractions', {params:
              {'categoryId': categoryId, 'userId': 'me', 'friends': 'true'}});
        },
        disconnect: function() {
          return $http.post(Conf.apiBase + 'disconnect');
        },
        searchAttractions: function(term) {
          return $http.get(Conf.apiBase + 'attractions', {params:
              {'search': term}});
        },
        searchAttractionsByLocation: function(term) {
            term = decodeURIComponent(term);
          return $http.get(Conf.apiBase + 'attractions?' + term);
        }
      };
    })
;
