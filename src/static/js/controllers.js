'use strict';

app.controller('AffordableCultureCtrl', function ($scope, $route, $http, $routeParams, $location, $templateCache, Conf, AffordableCultureApi) {

//function AffordableCultureCtrl($scope, $route, $http, $routeParams, $location, $templateCache, Conf, AffordableCultureApi) {

  $scope.$route = $route;
  $scope.$location = $location;
  $scope.$routeParams = $routeParams;

  $scope.map;
  $scope.notification;

  // signIn
  $scope.userProfile = undefined;
  $scope.hasUserProfile = false;
  $scope.isSignedIn = false;
  $scope.immediateFailed = false;

  // categories
  $scope.selectedCategory;
  $scope.selectedAttractionId;

  $scope.categories = [];

  // attractions
  $scope.ordering;
  $scope.recentButtonClasses;
  $scope.popularButtonClasses;

  $scope.highlightedAttraction;
  $scope.userAttractions = [];
  $scope.allAttractions = [];

  $scope.locationToSearch = undefined;
  // friends
  $scope.friends = [];
  // uploads
  $scope.uploadUrl;

  $scope.showCarousel = true;

  $scope.keywords = undefined;

    $scope.$on("$routeChangeSuccess", function(){
        //$scope.view = $route.current.action;
        console.log('$routeChangeSuccess', $route.current.action);

        if ($route.current.action == 'search') {
            var search = $route.current.params.search.replace('+', ' ');
            var location = $route.current.params.location.replace('@', '').split(',');
            $scope.setLocationToSearch(location[0]+','+location[1], search);
        }

    });

  $scope.$on('$routeChangeStart', function(next, current) {
    console.log('$routeChangeStart', next.params, current.params);
    //render();
  });

  $scope.$watch('locationToSearch', function(newValue, oldValue) {
      console.log('$scope.$watch.locationToSearch', newValue, oldValue);
      if (newValue) {
          $scope.searchByLocation(newValue);
      }
  });

  $scope.$watch('notification', function(newValue, oldValue) {
      console.log('$scope.$watch.notification', newValue, oldValue);
      if (newValue) {
          $scope.searchByLocation(newValue);
      }
  });

  $scope.setLocationToSearch = function(location, keywords) {
      console.log('setLocationToSearch', location, keywords);
      $scope.locationToSearch = location;
      $scope.keywords = keywords;
  };

  $scope.disconnect = function() {
    AffordableCultureApi.disconnect().then(function() {
      $scope.userProfile = undefined;
      $scope.hasUserProfile = false;
      $scope.isSignedIn = false;
      $scope.immediateFailed = true;
      $scope.userAttractions = [];
      $scope.friendsAttractions = [];
      $scope.renderSignIn();
    });
  };

  $scope.search = function() {
    //$location.hash('!search/' + $scope.keywords);

    AffordableCultureApi.searchAttractions($scope.keywords).then(function(response) {
        //console.log('searchAttractions', response);
        $scope.allAttractions = $scope.adaptAttractions(response.data);

        $scope.populateResults(response);
    },function(response){
        $scope.allAttractions = null;
        $scope.showCarousel = true;
        console.log('error:', response);
    });
  };


  $scope.getAttractionsByWantToGo = function() {
    //$location.hash('!search/' + $scope.keywords);
    $scope.keywords = '';

    AffordableCultureApi.getAttractionsByWantToGo().then(function(response) {
        //console.log('searchAttractions', response);

        if (response.data.length) {
            $scope.allAttractions = $scope.adaptAttractions(response.data);
            $scope.populateResults(response);
        } else {
            $scope.allAttractions = null;
            $scope.showCarousel = true;
        }

    },function(response){
        $scope.allAttractions = null;
        $scope.showCarousel = true;
        console.log('error:', response);
    });
  };


  $scope.searchByLocation = function() {
    //$location.hash('!search/' + $scope.keywords);
    console.log('$scope.searchByLocation', $scope.locationToSearch, $scope.keywords);

      $scope.loading = true;

    AffordableCultureApi.searchAttractionsByLocation($scope.locationToSearch, $scope.keywords).then(function(response) {
        //console.log('searchAttractionsByLocation', response);
        $scope.allAttractions = $scope.adaptAttractions(response.data);
        $scope.loading = false;

        $scope.populateResults(response);

        //console.log('$scope.allAttractions', $scope.allAttractions);
    });
  };

  $scope.populateResults = function(response) {
        neighborhoods = [];

        if (!$scope.allAttractions) {
            $('#map-canvas').addClass('opacity');
            $scope.showCarousel = true;
            return;
        }

        $('#map-canvas').removeClass('opacity');

        $scope.showCarousel = false;


        //map.clearOverlays();
        var bounds = new google.maps.LatLngBounds();

        angular.forEach(response.data, function(value, key) {
              if (value['location']) {

                var marker = new google.maps.LatLng(value['location']['lat'], value['location']['lon']);

                neighborhoods.push(marker);

                bounds.extend(marker);

            }
        });

        if (neighborhoods.length) {
            ignoreZoomEvent = true;

            map.fitBounds(bounds);

            for (var i = 0; i < neighborhoods.length; i++) {
                addMarker(neighborhoods[i], $scope.allAttractions[i], $scope.selectedAttractionId);
            }

        }

  };

  // methods
  $scope.orderBy = function(criteria) {
    var activeItemClasses = ['active','primary'];
    if (criteria == 'recent') {
      $scope.ordering = '-dateCreated';
      $scope.recentButtonClasses = activeItemClasses;
      $scope.popularButtonClasses = [];
    } else if (criteria == 'popular') {
      $scope.ordering = '-votes';
      $scope.popularButtonClasses = activeItemClasses;
      $scope.recentButtonClasses = [];
    }
  };

  $scope.adaptAttractions = function(attraction) {
    angular.forEach(attraction, function(value, key) {
      value['canDelete'] = false;
      value['canApprove'] = false;

      value['canVoteBeenThere'] = false;
      value['canVoteWantToGo'] = false;
      value['voteBeenThereClass'] = [];
      value['voteWantToGoClass'] = [];

      if (!value['image']) {
          value['thumbnailUrl'] = '/img/attraction-placeholder.jpg';
      } else {
          value['thumbnailUrl'] = value['image'];
      }

      if ($scope.hasUserProfile) {
        if (value.ownerUserId != $scope.userProfile.id) {
          //value['canDelete'] = true;
        } else {
          if ($scope.userProfile.role == 'admin') {
            value['canDelete'] = true;
            value['canApprove'] = true;
          }
          value['canVoteBeenThere'] = true;

          value['voteBeenThereClass'] = ['button', 'icon', 'arrowup'];
          if (value.votedBeenThere) {
            value['voteBeenThereClass'].push('disable');
          } else {
            value.votedBeenThere = false;
          }

          value['canVoteWantToGo'] = true;
          value['voteWantToGoClass'] = ['button', 'icon', 'arrowup'];
          if (value.votedWantToGo) {
            value['voteWantToGoClass'].push('disable');
          } else {
            value.votedWantToGo = false;
          }
        }
      }
    });
    return attraction;
  };

  $scope.updateAttractionPhoto = function(attractionId) {
    console.log('updateAttractionPhoto', attractionId);
    //AffordableCultureApi.updateAttractionPhoto(attractionId);
  };

  $scope.deleteAttraction = function(attractionId) {
    AffordableCultureApi.deleteAttraction(attractionId);
    $scope.userAttractions = $scope.removeFromArray($scope.userAttractions, attractionId);
    $scope.friendsAttractions = $scope.removeFromArray($scope.friendsAttractions, attractionId);
    $scope.allAttractions = $scope.removeFromArray($scope.allAttractions, attractionId);
  };


  $scope.removeFromArray = function (array, id) {
    var newArray = [];
    angular.forEach(array, function(value, key) {
      if (value.id != id) {
        newArray.push(value);
      }
    });
    return newArray;
  };


  $scope.goHome = function() {

    $scope.showCarousel = true;

    $scope.userAttractions = null;
    $scope.allAttractions = null;
  };


  $scope.getUserAttractions = function() {
    if ($scope.hasUserProfile && ($scope.categories.length > 0)) {
      AffordableCultureApi.getUserAttractionsByCategory($scope.selectedCategory.id)
      	  .then(function(response) {
        $scope.userAttractions = $scope.adaptAttractions(response.data);
      });
    }
  };

    $scope.getAllAttractions = function() {
    AffordableCultureApi.getAllAttractionsByCategory($scope.selectedCategory.id)
    	.then(function(response) {
      $scope.allAttractions = $scope.adaptAttractions(response.data);
    });
  };

  $scope.getFriendsAttractions = function() {
    AffordableCultureApi.getFriendsAttractionsByCategory($scope.selectedCategory.id)
        .then(function(response) {
      $scope.friendsAttractions = $scope.adaptAttractions(response.data);
    });
  };

  $scope.getUploadUrl = function(params) {
    AffordableCultureApi.getUploadUrl().then(function(response) {
      $scope.uploadUrl = response.data.url;
    });
  };
  
  $scope.checkIfVoteActionRequested = function() {
    if($location.search()['action'] == 'VOTEWANTTOGO') {
      AffordableCultureApi.votedWantToGo($location.search()['attractionId'])
          .then(function(response) {
        $scope.highlightedAttraction = response.data;
        $scope.notification = 'Thanks for voting!';
      });
    }
  };
  
  $scope.getFriends = function() {
    AffordableCultureApi.getFriends().then(function(response) {
      $scope.friends = response.data;
      $scope.getFriendsAttractions();
    })
  };
  
  $scope.selectCategory = function(themeIndex) {
    $scope.selectedCategory = $scope.categories[themeIndex];
    if ($scope.selectedCategory.id != $scope.categories[0].id) {
      $scope.orderBy('popular');
    }
    $scope.getAllAttractions();
    if($scope.isSignedIn) {
      $scope.getUserAttractions();
    }
    if ($scope.friends.length) {
      $scope.getFriendsAttractions();
    }
  };
  
  $scope.canUpload = function() {
      if (!$scope.uploadUrl) {
          return false;
      } else {
          return true;
      }
  };
  
  $scope.uploadedPhoto = function(uploadedPhoto) {
    uploadedPhoto['canDelete'] = true;
    $scope.userAttractions.unshift(uploadedPhoto);
    $scope.allAttractions.unshift(uploadedPhoto);
    $scope.getUploadUrl();
  };
  
  $scope.signedIn = function(profile) {
    $scope.isSignedIn = true;
    $scope.userProfile = profile;
    $scope.hasUserProfile = true;
    //$scope.getUserAttractions();
    // refresh the state of operations that depend on the local user
    $scope.allAttractions = $scope.adaptAttractions($scope.allAttractions);
    // now we can perform other actions that need the user to be signed in
    $scope.getUploadUrl();
    $scope.checkIfVoteActionRequested();
    //$scope.getFriends();
  };
  
  $scope.checkForHighlightedAttraction = function() {
    if($location.search()['attractionId']) {
      AffordableCultureApi.getAttraction(location.search()['attractionId'])
          .then(function(response) {
        $scope.highlightedAttraction = response.data;
      })
    }
  };
  
  $scope.signIn = function(authResult) {
    $scope.$apply(function() {
      $scope.processAuth(authResult);
    });
  };
  
  $scope.processAuth = function(authResult) {
    $scope.immediateFailed = true;
    if ($scope.isSignedIn) {
      return 0;
    }
    if (authResult['access_token']) {
      $scope.immediateFailed = false;
      // Successfully authorized, create session
      AffordableCultureApi.signIn(authResult).then(function(response) {
        $scope.signedIn(response.data);
      },function(response) {
          console.log('signIn:failure:', response);
          //hack to reload page after failure
          $route.reload();
      });
    } else if (authResult['error']) {
      if (authResult['error'] == 'immediate_failed') {
        $scope.immediateFailed = true;
      } else {
        console.log('Error:' + authResult['error']);
      }
    }
  };

  $scope.renderSignInDialog = function() {
      console.log('myGsigninDialog');
    gapi.signin.render('myGsigninDialog', {
      'callback': $scope.signIn,
      'clientid': Conf.clientId,
      'requestvisibleactions': Conf.requestvisibleactions,
      'scope': Conf.scopes,
      'apppackagename': Conf.apppackagename,
      'theme': 'dark',
      'cookiepolicy': Conf.cookiepolicy,
      'accesstype': 'offline'
    });
  };

  $scope.renderSignIn = function() {
    gapi.signin.render('myGsignin', {
      'callback': $scope.signIn,
      'clientid': Conf.clientId,
      'requestvisibleactions': Conf.requestvisibleactions,
      'scope': Conf.scopes,
      'apppackagename': Conf.apppackagename,
      'theme': 'dark',
      'cookiepolicy': Conf.cookiepolicy,
      'accesstype': 'offline'
    });
  };

  $scope.fetch = function(method, url) {
    $scope.code = null;
    $scope.response = null;

    $http({method: method, url: url, cache: $templateCache}).
      success(function(data, status) {
        console.log('success', status, data);
        $scope.status = status;
        $scope.data = data;
      }).
      error(function(data, status) {
        console.log('error', status, data);
        $scope.data = data || "Request failed";
        $scope.status = status;
    });
  };
  
  $scope.start = function() {
    $scope.renderSignIn();
    //$scope.checkForHighlightedAttraction();

      //show predefined attraction
      if ($location.search().attractionId && $location.search().ll && $location.search().z) {
        $scope.locationToSearch = 'attractionId=' + ($location.search()).attractionId +  '&ll=' + ($location.search().ll) + '&z=' + ($location.search()).z;
        $scope.selectedAttractionId = ($location.search()).attractionId;
        var ll = $location.search().ll.split(',');

        var location = new google.maps.LatLng(ll[0], ll[0]);
        //map.setCenter(location);

      } else {
          $scope.selectedAttractionId = undefined;
      }


    if (false) {
      AffordableCultureApi.getCategories().then(function(response) {
      $scope.categories = response.data;
      $scope.selectedCategory = $scope.categories[0];
      $scope.orderBy('recent');
      //$scope.getUserAttractions();
      var options = {
        'clientid': Conf.clientId,
        'contenturl': Conf.rootUrl + '/invite.html',
        'contentdeeplinkid': '/',
        'prefilltext': 'Join the Affordable Culture, add and vote for ' +
            $scope.selectedCategory.name + '. #affordableculture',
        'calltoactionlabel': 'Join',
        'calltoactionurl': Conf.rootUrl,
        'calltoactiondeeplinkid': '/',
        'callback': $scope.signIn,
        'requestvisibleactions': Conf.requestvisibleactions,
        'scope': Conf.scopes,
        'cookiepolicy': Conf.cookiepolicy
      };
      gapi.interactivepost.render('invite', options);


    });
  }

  };
  
  $scope.start();
});

//app.controller('AffordableCultureCtrl', ['$scope', '$routeParams',
//  function($scope, $routeParams) {
//      console.log('$routeParams', $routeParams);
//
//
//    //$scope.phoneId = $routeParams.phoneId;
//}]);