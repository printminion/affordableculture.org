'use strict';

function AffordableCultureCtrl($scope, $location, Conf, AffordableCultureApi) {
  // signIn
  $scope.userProfile = undefined;
  $scope.hasUserProfile = false;
  $scope.isSignedIn = false;
  $scope.immediateFailed = false;
  // themes
  $scope.selectedTheme;
  $scope.themes = [];
  // photos
  $scope.ordering;
  $scope.recentButtonClasses;
  $scope.popularButtonClasses;
  $scope.highlightedPhoto;
  $scope.userPhotos = [];
  $scope.allAttractions = [];
  $scope.friendsPhotos = [];

  // friends
  $scope.friends = [];
  // uploads
  $scope.uploadUrl;
  
  $scope.disconnect = function() {
    AffordableCultureApi.disconnect().then(function() {
      $scope.userProfile = undefined;
      $scope.hasUserProfile = false;
      $scope.isSignedIn = false;
      $scope.immediateFailed = true;
      $scope.userPhotos = [];
      $scope.friendsPhotos = [];
      //$scope.renderSignIn();
    });
  };

  $scope.search = function() {
    AffordableCultureApi.search($scope.keywords).then(function(response) {
        //console.log('search', response);
        $scope.allAttractions = $scope.adaptAttractions(response.data);
        //console.log('$scope.allAttractions', $scope.allAttractions);
    });
  };
  
  // methods
  $scope.orderBy = function (criteria) {
    var activeItemClasses = ['active','primary'];
    if (criteria == 'recent') {
      $scope.ordering = '-dateCreated';
      $scope.recentButtonClasses = activeItemClasses;
      $scope.popularButtonClasses = [];
    } else if (criteria == 'popular') {
      $scope.ordering = '-votes';
      $scope.popularButtonClasses = activeItemClasses;
      $scope.recentButtonClasses = [];
    } else {
      return 0;
    }
  };

  $scope.adaptAttractions = function(photos) {
    angular.forEach(photos, function(value, key) {
      value['canDelete'] = false;
      value['canVoteBeenThere'] = false;
      value['canVoteWantToGo'] = false;
      value['voteClass'] = [];
      if ($scope.hasUserProfile) {
        if (value.ownerUserId == $scope.userProfile.id) {
          value['canDelete'] = true;
        } else {
          if ($scope.userProfile.role == 'admin') {
            value['canDelete'] = true;
          }
          value['canVoteBeenThere'] = true;
          value['canVoteWantToGo'] = true;
          value['voteClass'] = ['button', 'icon', 'arrowup'];
          if (value.votedBeenThere) {
            value['voteClass'].push('disable');
          } else {
            value.votedBeenThere = false;
          }
        }
      }
    });
    return photos;
  };

  $scope.adaptPhotos = function(photos) {
    angular.forEach(photos, function(value, key) {
      value['canDelete'] = false;
      value['canVote'] = false;
      value['voteClass'] = [];
      if ($scope.hasUserProfile) {
        if (value.ownerUserId == $scope.userProfile.id) {
          value['canDelete'] = true;
        } else {
          if ($scope.userProfile.role == 'admin') {
            value['canDelete'] = true;
          }
          value['canVote'] = true;
          value['voteClass'] = ['button', 'icon', 'arrowup'];
          if (value.voted) {
            value['voteClass'].push('disable');
          } else {
            value.voted = false;
          }
        }
      }
    });
    return photos;
  };
  
  $scope.deletePhoto = function(photoId) {
    AffordableCultureApi.deletePhoto(photoId);
    $scope.userPhotos = $scope.removePhotoFromArray($scope.userPhotos, photoId);
    $scope.friendsPhotos = $scope.removePhotoFromArray($scope.friendsPhotos, photoId);
    $scope.allPhotos = $scope.removePhotoFromArray($scope.allPhotos, photoId);
  };
  
  $scope.removePhotoFromArray = function (array, photoId) {
    var newArray = [];
    angular.forEach(array, function(value, key) {
      if (value.id != photoId) {
        newArray.push(value);
      }
    });
    return newArray;
  };
  
  $scope.getUserPhotos = function() {
    if ($scope.hasUserProfile && ($scope.themes.length > 0)) {
      AffordableCultureApi.getUserPhotosByTheme($scope.selectedTheme.id)
      	  .then(function(response) {
        $scope.userPhotos = $scope.adaptPhotos(response.data);
      });
    }
  };
  
  $scope.getAllPhotos = function() {
    AffordableCultureApi.getAllPhotosByTheme($scope.selectedTheme.id)
    	.then(function(response) {
      $scope.allPhotos = $scope.adaptPhotos(response.data);
    });
  };
  
  $scope.getFriendsPhotos = function() {
    AffordableCultureApi.getFriendsPhotosByTheme($scope.selectedTheme.id)
        .then(function(response) {
      $scope.friendsPhotos = $scope.adaptPhotos(response.data);
    });
  };
  
  $scope.getUploadUrl = function(params) {
    AffordableCultureApi.getUploadUrl().then(function(response) {
      $scope.uploadUrl = response.data.url;
    });
  };
  
  $scope.checkIfVoteActionRequested = function() {
    if($location.search()['action'] == 'VOTE') {
      AffordableCultureApi.votePhoto($location.search()['photoId'])
          .then(function(response) {
        var photo = response.data;
        $scope.highlightedPhoto = photo;
        $scope.notification = 'Thanks for voting!';
      });
    }
  };
  
  $scope.getFriends = function() {
    AffordableCultureApi.getFriends().then(function(response) {
      $scope.friends = response.data;
      $scope.getFriendsPhotos();
    })
  }
  
  $scope.selectTheme = function(themeIndex) {
    $scope.selectedTheme = $scope.themes[themeIndex];
    if ($scope.selectedTheme.id != $scope.themes[0].id) {
      $scope.orderBy('popular');
    }
    $scope.getAllPhotos();
    if($scope.isSignedIn) {
      $scope.getUserPhotos();
    }
    if ($scope.friends.length) {
      $scope.getFriendsPhotos();
    }
  };
  
  $scope.canUpload = function() {
    if ($scope.uploadUrl) {
        return true;
    } else {
        return false;
    }
  };
  
  $scope.uploadedPhoto = function(uploadedPhoto) {
    uploadedPhoto['canDelete'] = true;
    $scope.userPhotos.unshift(uploadedPhoto);
    $scope.allPhotos.unshift(uploadedPhoto);
    $scope.getUploadUrl();
  };
  
  $scope.signedIn = function(profile) {
    $scope.isSignedIn = true;
    $scope.userProfile = profile;
    $scope.hasUserProfile = true;
    $scope.getUserPhotos();
    // refresh the state of operations that depend on the local user
    $scope.allPhotos = $scope.adaptPhotos($scope.allPhotos);
    // now we can perform other actions that need the user to be signed in
    $scope.getUploadUrl();
    $scope.checkIfVoteActionRequested();
    $scope.getFriends();
  };
  
  $scope.checkForHighlightedPhoto = function() {
    if($location.search()['photoId']) {
      AffordableCultureApi.getPhoto($location.search()['photoId'])
          .then(function(response) {
        $scope.highlightedPhoto = response.data;
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
      });
    } else if (authResult['error']) {
      if (authResult['error'] == 'immediate_failed') {
        $scope.immediateFailed = true;
      } else {
        console.log('Error:' + authResult['error']);
      }
    }
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
  
  $scope.start = function() {
    $scope.renderSignIn();
    $scope.checkForHighlightedPhoto();
    AffordableCultureApi.getThemes().then(function(response) {
      $scope.themes = response.data;
      $scope.selectedTheme = $scope.themes[0];
      $scope.orderBy('recent');
      $scope.getUserPhotos();
      var options = {
        'clientid': Conf.clientId,
        'contenturl': Conf.rootUrl + '/invite.html',
        'contentdeeplinkid': '/',
        'prefilltext': 'Join the hunt, upload and vote for photos of ' +
            $scope.selectedTheme.displayName + '. #affordableculture',
        'calltoactionlabel': 'Join',
        'calltoactionurl': Conf.rootUrl,
        'calltoactiondeeplinkid': '/',
        'callback': $scope.signIn,
        'requestvisibleactions': Conf.requestvisibleactions,
        'scope': Conf.scopes,
        'cookiepolicy': Conf.cookiepolicy
      };
      gapi.interactivepost.render('invite', options);
      $scope.getAllPhotos();
    });
  };
  
  $scope.start();
  
}
