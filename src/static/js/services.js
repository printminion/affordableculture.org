'use strict';

angular.module('affordableCulture.services', [])
    .factory('Conf', function($location) {
      function getRootUrl() {
        var rootUrl = $location.protocol() + '://' + $location.host();
        if ($location.port())
          rootUrl += ':' + $location.port();
        return rootUrl;
      };
      return {
        'clientId': '622222016553.apps.googleusercontent.com',
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
        votePhoto: function(photoId) {
          return $http.put(Conf.apiBase + 'votes',
              {'photoId': photoId});
        },
        getThemes: function() {
          return $http.get(Conf.apiBase + 'themes');
        },
        getUploadUrl: function() {
          return $http.post(Conf.apiBase + 'images');
        },
        getAllPhotosByTheme: function(themeId) {
          return $http.get(Conf.apiBase + 'photos',
              {params: {'themeId': themeId}});
        },
        getPhoto: function(photoId) {
          return $http.get(Conf.apiBase + 'photos', {params:
              {'photoId': photoId}});
        },
        getUserPhotosByTheme: function(themeId) {
          return $http.get(Conf.apiBase + 'photos', {params: 
              {'themeId': themeId, 'userId': 'me'}});
        },
        getFriends: function () {
          return $http.get(Conf.apiBase + 'friends');
        },
        getFriendsPhotosByTheme: function(themeId) {
          return $http.get(Conf.apiBase + 'photos', {params:
              {'themeId': themeId, 'userId': 'me', 'friends': 'true'}});
        },
        deletePhoto: function(photoId) {
          return $http.delete(Conf.apiBase + 'photos', {params:
              {'photoId': photoId}});
        },
        disconnect: function() {
          return $http.post(Conf.apiBase + 'disconnect');
        }
      };
    })
;
