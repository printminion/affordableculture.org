'use strict';

angular.module('affordableCulture.directives', ['affordableCulture.services'])
//    .directive('photo', function(Conf, AffordableCultureApi) {
//      return {
//        restrict: 'E',
//        replace: true,
//        scope: {
//          item: '=',
//          deletePhoto: '&deletePhoto'
//        },
//        templateUrl: 'partials/_photo.html',
//        link: function (scope, element, attrs) {
//          element.find('.voteButton')
//              .click(function(evt) {
//                if(scope.item.canVote && !scope.item.voted) {
//                  var voteButton = angular.element(evt.target);
//                  scope.$apply(function() {
//                    voteButton.unbind('click');
//                    scope.item.numVotes = scope.item.numVotes + 1;
//                    scope.item.voted = true;
//                    voteButton.focus();
//                    scope.item.voteClass.push('disable');
//                  });
//                  AffordableCultureApi.votePhoto(scope.item.id)
//                      .then(function(response) {});
//                }
//              });
//
//          element.find('.remove')
//              .click(function() {
//                if (scope.item.canDelete) {
//                  scope.deletePhoto({photoId: scope.item.id});
//                }
//              });
//
//          var options = {
//            'clientid': Conf.clientId,
//            'contenturl': scope.item.photoContentUrl,
//            'contentdeeplinkid': '/?id=' + scope.item.id,
//            'prefilltext': 'What do you think?  Does this image embody \'' +
//                scope.item.themeDisplayName + '\'? #affordableculture',
//            'calltoactionlabel': 'VOTE',
//            'calltoactionurl': scope.item.voteCtaUrl,
//            'calltoactiondeeplinkid': '/?id=' + scope.item.id + '&action=VOTE',
//            'requestvisibleactions': Conf.requestvisibleactions,
//            'scope': Conf.scopes,
//            'cookiepolicy': Conf.cookiepolicy
//          };
//          gapi.interactivepost.render(
//              element.find('.toolbar button').get(0), options);
//        }
//      }
//    })
    .directive('attraction', function(Conf, AffordableCultureApi) {
      return {
        restrict: 'E',
        replace: true,
        scope: {
          item: '=',
          deletePhoto: '&deletePhoto'
        },
        templateUrl: 'partials/attraction.html',
        link: function (scope, element, attrs) {
            console.log('scope.item', scope.item);

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
                }
              });
          element.find('.remove')
              .click(function() {
                if (scope.item.canDelete) {
                  scope.deleteAttraction({photoId: scope.item.id});
                }
              });

            console.log('scope', scope);

          var options = {
            'clientid': Conf.clientId,
            'contenturl': scope.item.attractionContentUrl,
            'contentdeeplinkid': '/?id=' + scope.item.id,
            'prefilltext': '*Having fun doesn’t require a lot of money!*\n' +
               'Visiting this attraction will help you to see more while spending less.\n' +
              'Having fun doesn’t require a lot of money! Visiting this attraction will help ' +
                'you to see more while paying less while visiting the \n' +
                scope.item.name + ' #affordableculture',
            'calltoactionlabel': 'VOTE',
            'calltoactionurl': scope.item.voteCtaUrl,
            'calltoactiondeeplinkid': '/?id=' + scope.item.id + '&action=VOTE',
            'requestvisibleactions': Conf.requestvisibleactions,
            'scope': Conf.scopes,
            'cookiepolicy': Conf.cookiepolicy
          };

          gapi.interactivepost.render(
              element.find('.toolbar button').get(0), options);
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
;