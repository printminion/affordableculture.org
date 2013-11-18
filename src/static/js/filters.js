'use strict';

angular.module('affordableCulture.filters', [])
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
.filter( 'domain', function () {
  return function ( input ) {
    var matches,
        output = "",
        urls = /\w+:\/\/([\w|\.]+)/;

    matches = urls.exec( input );

    if ( matches !== null ) output = matches[1];
    output = output.replace('www.', '');
    return output;
  };
});
