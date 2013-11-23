'use strict';

angular.module('affordableCulture.directives', ['affordableCulture.services'])
    .directive('attraction', function(Conf, AffordableCultureApi, NotificationService) {
      return {
        restrict: 'E',
        replace: true,
        scope: {
          item: '=',
          deleteAttraction: '&deleteAttraction',
          updateAttractionPhoto: '&updateAttractionPhoto',
          renderSignInDialog: '&renderSignInDialog'
        },
        templateUrl: 'partials/attraction_new.html',
        link: function (scope, element, attrs) {
          //console.log('scope.item', scope.item);

          element.find('.voteButtonBeenThere').click(function(evt) {
                if(scope.item.canVoteBeenThere && !scope.item.votedBeenThere) {
                  var voteButton = angular.element(evt.target);
                  scope.$apply(function() {
                    voteButton.unbind('click');
                    scope.item.numVotesBeenThere = scope.item.numVotesBeenThere + 1;
                    scope.item.votedBeenThere = true;
                    voteButton.focus();
                    scope.item.voteBeenThereClass.push('disable');
                  });
                  AffordableCultureApi.voteAttractionBeenThere(scope.item.id)
                      .then(function(response) {});
                } else {
                    $('#myModalLogin').modal('show');
                }
              });

          element.find('.voteButtonWantToGo').click(function(evt) {
            if(scope.item.canVoteWantToGo && !scope.item.votedWantToGo) {
              var voteButton = angular.element(evt.target);
              scope.$apply(function() {
                voteButton.unbind('click');
                scope.item.numVotesWantToGo = scope.item.numVotesWantToGo + 1;
                scope.item.votedWantToGo = true;
                voteButton.focus();
                scope.item.voteWantToGoClass.push('disable');
              });
              AffordableCultureApi.voteAttractionWantToGo(scope.item.id)
                  .then(function(response) {});
            } else {
                $('#myModalLogin').modal('show');
            }
          });

          element.find('.remove').click(function() {
                if (scope.item.canDelete) {
                  scope.deleteAttraction({attractionId: scope.item.id});
                }
          });

            //console.log('scope', scope);

          var options = {
            'clientid': Conf.clientId,
            'contenturl': scope.item.attractionContentUrl,
            'contentdeeplinkid': '/?id=' + scope.item.id,
            'prefilltext': 'Having fun doesn’t require a lot of money! *'
                + scope.item.name + '* is just one of many hundreds of affordable attractions to explore.\n'
                +'Visit AffordableCulture.org to discover the world\'s most memorable yet absolutely free ' +
                'cultural experiences at your fingertips. #affordableculture',
            'calltoactionlabel': 'DISCOVER',
            'calltoactionurl': scope.item.voteCtaUrl,
            'calltoactiondeeplinkid': '/?id=' + scope.item.id + '&action=DISCOVER',
            'requestvisibleactions': Conf.requestvisibleactions,
            'scope': Conf.scopes,
            'cookiepolicy': Conf.cookiepolicy
          };

          gapi.interactivepost.render(element.find('#googleplus-share').get(0), options);
        }
      }
    })
    .directive('uploadBox', function() {
      return {
        restrict: 'A',
        scope: {
          uploadUrl: '=uploadUrl',
          onComplete: '&onComplete'
        },
        templateUrl: 'partials/uploadBox.html',
        link: function (scope, element, attrs) {
          element.filedrop({
            paramname: 'image',
            maxfiles: 1,
            maxfilesize: 10,
            drop: function() {
              this.url = scope.uploadUrl;
            },
            uploadFinished: function(i, file, response) {
              scope.uploadStarted = false;
              scope.onComplete({photo: response});
            },
            error: function(err, file) {
              switch (err) {
                case 'BrowserNotSupported':
                  alert('Your browser does not support HTML5 file uploads!');
                  break;
                case 'TooManyFiles':
                  alert('Too many files!');
                  break;
                case 'FileTooLarge':
                  alert(file.name + ' is too large! Please upload files up to 10mb.');
                  break;
                default:
                  break;
              }
            },
            // Called before each upload is started
            beforeEach: function(file) {
              if (!file.type.match(/^image\//)) {
                alert('Only images are allowed!');
                // Returning false will cause the
                // file to be rejected
                return false;
              }
            },
            uploadStarted: function(i, file, len) {
              scope.uploadStarted = true;
              scope.uploadProgress = 0;
              var reader = new FileReader();
              reader.onload = function(e) {
                // e.target.result holds the DataURL which
                // can be used as a source of the image:
                scope.$apply(function() {
                  scope.imagePreview = e.target.result;
                });
              };
              // Reading the file as a DataURL. When finished,
              // this will trigger the onload function above:
              reader.readAsDataURL(file);
            },
            progressUpdated: function (i, file, progress) {
              scope.uploadProgress = progress;
            }
          });
        }
      }
    })
    .directive('helloMaps', function () {
            return {
        restrict: 'A',
        replace: true,
        scope: {
          item: '=',
          deleteAttraction: '&deleteAttraction'
        },

        link: function (scope, elem, attrs) {
          console.log('scope', scope);
        var mapOptions,
          latitude = attrs.latitude,
          longitude = attrs.longitude;

        latitude = latitude && parseFloat(latitude, 10) || 43.074688;
        longitude = longitude && parseFloat(longitude, 10) || -89.384294;

        mapOptions = {
          center: new google.maps.LatLng(latitude, longitude),
            zoom: 10,
            mapTypeId: google.maps.MapTypeId.ROADMAP,
            streetViewControl: false,
            mapTypeControl: false,
            'scrollwheel': false
        };

        map = new google.maps.Map(elem[0], mapOptions);



              var input = /** @type {HTMLInputElement} */(
        document.getElementById('search'));

    var autocomplete = new google.maps.places.Autocomplete(input);
    autocomplete.bindTo('bounds', map);

    google.maps.event.addListener(autocomplete, 'place_changed', function () {
        console.log('place_changed', map.getZoom(), map.getCenter());


        var place = autocomplete.getPlace();
        if (!place.geometry) {
            return;
        }

        $('#map-canvas').removeClass('opacity');
        $('#myCarousel').hide();

        var location = place.geometry.location;
        map.setCenter(location);
        //map.setZoom(13);  // Why 17? Because it looks good.

        var search = 'z=' +  map.getZoom() + '&ll=' + location.ob + ',' + location.pb;
        console.log('search:place_changed', search);

        if (!dontCallSearch) {
            var inputSearchByLocation = $('#searchByLocation');
            inputSearchByLocation.val(search);
            inputSearchByLocation.trigger('input');
        }

        var inputSearch = $('#search');
            inputSearch.trigger('input');


    });

   google.maps.event.addListenerOnce(map, 'bounds_changed', function(event) {
        console.log('bounds_changed', map.getZoom(), map.getCenter());
        if (neighborhoods.length == 1) {
            map.setZoom(18);
        }

       ignoreZoomEvent = false;
   });

    google.maps.event.addListener(map, 'zoom_changed', function () {
        console.log('zoom_changed', map.getZoom(), map.getCenter());
        if (ignoreZoomEvent) {
            return;
        }
        //zoom_changed
        var location = map.getCenter();
        var search = 'z=' +  map.getZoom() + '&ll=' + location.ob + ',' + location.pb;
        console.log('search:zoom_changed', search);

        if (!dontCallSearch) {
            var inputSearchByLocation = $('#searchByLocation');
            inputSearchByLocation.val(search);
            inputSearchByLocation.trigger('input');
        }

    });

//    google.maps.event.addListener(map, 'center_changed', function () {
//        console.log('center_changed', map.getZoom(), map.getCenter());
//
//        //zoom_changed
//        var location = map.getCenter();
//        var search = 'z=' +  map.getZoom() + '&ll=' + location.ob + ',' + location.pb;
//        console.log('search', search);
//
//        $('#searchByLocation').val(search);
//
//    });


    google.maps.event.addListener(map, 'mouseup', function () {
        console.log('mouseup', map.getZoom(), map.getCenter());

        //zoom_changed
        var location = map.getCenter();
        var search = 'z=' +  map.getZoom() + '&ll=' + location.ob + ',' + location.pb;
        console.log('search:mouseup', search);

        $('#searchByLocation').val(search);

    });

    google.maps.Map.prototype.clearMarkers = function () {
        for (var i = 0; i < this.markers.length; i++) {
            this.markers[i].setMap(null);
        }
        this.markers = [];
    };

        } };
    })
    .directive('PostDataNotification', function () {

        return function (scope, element, attrs) {
            scope.$on('notificationBroadcast', function (event, args) {
                scope.notificationMessage = args.Message;
                $('.notification').miniNotification({ time: 3000 });
            });
        };

})
;