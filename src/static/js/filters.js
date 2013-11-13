'use strict';

angular.module('photoHunt.filters', [])
    .filter('profilePicture', function() {
      return function(profilePicUrl, size) {
        if(profilePicUrl) {
          var clean = profilePicUrl.replace(/\?sz=(\d)*$/, ''); 
          return clean + '?sz=' + size;
        } else {
          return '';
        }
      };
    })
;