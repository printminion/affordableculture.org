#!/usr/bin/python

"""All request handlers of AffordableCulture, including its built-in API."""

import httplib2
import model
import logging
import json
import os
import random
import string
import apiclient
import webapp2
import datetime
import jinja2
import re
from apiclient.discovery import build
from google.appengine.ext import db
from google.appengine.ext.webapp import blobstore_handlers
from google.appengine.ext import blobstore
from google.appengine.api import urlfetch
from google.appengine.api.app_identity import get_default_version_hostname
import oauth2client
from oauth2client.client import flow_from_clientsecrets
from oauth2client.client import FlowExchangeError
from webapp2_extras import sessions
from google.appengine.ext import deferred

from google.appengine.api import users

JINJA_ENV = jinja2.Environment(
    loader=jinja2.FileSystemLoader(
        os.path.join(os.path.dirname(__file__), 'templates')),
    extensions=['jinja2.ext.autoescape'])

CLIENT_ID = json.loads(
    open('%s/client_secrets.json' % os.path.dirname(__file__), 'r').read())['web']['client_id']

SCOPES = [
    'https://www.googleapis.com/auth/plus.login'
]

VISIBLE_ACTIONS = [
    'http://schemas.google.com/AddActivity',
    'http://schemas.google.com/ReviewActivity'
]

TOKEN_INFO_ENDPOINT = ('https://www.googleapis.com/oauth2/v1/tokeninfo' +
                       '?access_token=%s')
TOKEN_REVOKE_ENDPOINT = 'https://accounts.google.com/o/oauth2/revoke?token=%s'


class SessionEnabledHandler(webapp2.RequestHandler):
    """Base type which ensures that derived types always have an HTTP session."""
    CURRENT_USER_SESSION_KEY = 'me'

    def dispatch(self):
        """Intercepts default request dispatching to ensure that an HTTP session
        has been created before calling dispatch in the base type.
        """
        # Get a session store for this request.
        self.session_store = sessions.get_store(request=self.request)
        try:
            # Dispatch the request.
            webapp2.RequestHandler.dispatch(self)
        finally:
            # Save all sessions.
            self.session_store.save_sessions(self.response)

    @webapp2.cached_property
    def session(self):
        """Returns a session using the default cookie key."""
        return self.session_store.get_session()

    def get_user_from_session(self):
        """Convenience method for retrieving the users credentials from an
        authenticated session.
        """
        google_user_id = self.session.get(self.CURRENT_USER_SESSION_KEY)
        if google_user_id is None:
            raise UserNotAuthorizedException('Session did not contain user id.')
        user = model.User.all().filter('google_user_id =', google_user_id).get()
        if not user:
            raise UserNotAuthorizedException(
                'Session user ID could not be found in the datastore.')
        return user


class UserNotAuthorizedException(Exception):
    msg = 'Unauthorized request.'


class NotFoundException(Exception):
    msg = 'Resource not found.'


class RevokeException(Exception):
    msg = 'Failed to revoke token for given user.'


class JsonRestHandler(webapp2.RequestHandler):
    """Base RequestHandler type which provides convenience methods for writing
    JSON HTTP responses.
    """
    JSON_MIMETYPE = "application/json"

    def send_error(self, code, message):
        """Convenience method to format an HTTP error response in a standard format.
        """
        self.response.headers["Content-Type"] = self.JSON_MIMETYPE
        self.response.set_status(code, message)
        err = {'status': 'failure', 'code': code, 'message': message};
        self.response.out.write(json.dumps(err))

    def send_success(self, obj=None, jsonkind='affcult#unknown'):
        """Convenience method to format a affcult JSON HTTP response in a standard
        format.
        """
        self.response.headers["Content-Type"] = self.JSON_MIMETYPE
        if obj is not None:
            if isinstance(obj, basestring):
                self.response.out.write(obj)
            else:
                self.response.out.write(json.dumps(obj, cls=model.JsonifiableEncoder))


def get_base_url():
    """Returns the base URL for this application."""
    base = get_default_version_hostname()
    if "appspot.com" in base:
        return "https://%s" % base
    return "http://%s" % base


class ConnectHandler(JsonRestHandler, SessionEnabledHandler):
    """Provides an API to connect users to AffordableCulture.

    This handler provides the api/connect end-point, and exposes the following
    operations:
      POST /api/connect
    """

    @staticmethod
    def exchange_code(code):
        """Exchanges the `code` member of the given AccessToken object, and returns
        the relevant credentials.

        Args:
          code: authorization code to exchange.

        Returns:
          Credentials response from Google indicating token information.

        Raises:
          FlowExchangeException Failed to exchange code (code invalid).
        """
        oauth_flow = flow_from_clientsecrets('client_secrets.json',
                                             scope=' '.join(SCOPES))
        oauth_flow.request_visible_actions = ' '.join(VISIBLE_ACTIONS)
        oauth_flow.redirect_uri = 'postmessage'
        credentials = oauth_flow.step2_exchange(code)
        return credentials

    @staticmethod
    def get_token_info(credentials):
        """Get the token information from Google for the given credentials."""
        url = (TOKEN_INFO_ENDPOINT
               % credentials.access_token)
        return urlfetch.fetch(url)

    @staticmethod
    def get_user_profile(credentials):
        """Return the public Google+ profile data for the given user."""
        http = httplib2.Http()
        plus = build('plus', 'v1', http=http)
        credentials.authorize(http)
        return plus.people().get(userId='me').execute()

    @staticmethod
    def save_token_for_user(google_user_id, credentials):
        """Creates a user for the given ID and credential or updates the existing
        user with the existing credential.

        Args:
          google_user_id: Google user ID to update.
          credentials: Credential to set for the user.

        Returns:
          Updated User.
        """
        user = model.User.all().filter('google_user_id =', google_user_id).get()
        if user is None:
            # Couldn't find User in datastore.  Register a new user.
            profile = ConnectHandler.get_user_profile(credentials)
            user = model.User()
            user.google_user_id = profile.get('id')
            user.google_display_name = profile.get('displayName')
            user.google_public_profile_url = profile.get('url')
            image = profile.get('image')
            if image is not None:
                user.google_public_profile_photo_url = image.get('url')
        user.google_credentials = credentials
        user.put()
        return user

    @staticmethod
    def create_credentials(connect_credentials):
        """Creates oauth2client credentials from those supplied in a connect
        request.
        """
        # In this flow, the user is connecting without a refresh token.  This
        # credential will be good for an hour.
        refresh_token = ''
        _, client_info = oauth2client.clientsecrets.loadfile(
            'client_secrets.json', None)
        web_flow = flow_from_clientsecrets(
            'client_secrets.json', scope=' '.join(SCOPES))
        web_flow.request_visible_actions = ' '.join(VISIBLE_ACTIONS)
        web_flow.redirect_uri = 'postmessage'
        credentials = oauth2client.client.OAuth2Credentials(
            access_token=connect_credentials.get('access_token'),
            client_id=client_info.get('client_id'),
            client_secret=client_info['client_secret'],
            refresh_token=refresh_token,
            token_expiry=connect_credentials.get('expires_at'),
            token_uri=web_flow.token_uri,
            user_agent=web_flow.user_agent,
            id_token=connect_credentials.get('id_token'))
        return credentials

    @staticmethod
    def get_and_store_friends(user):
        """Query Google for the list of the user's friends that they've shared with
        our app, and then store those friends for later use.

        Args:
          user: User to get friends for.
        """

        # Delete the friends for the given user first.
        edges = model.DirectedUserToUserEdge.all().filter(
            'owner_user_id = ', user.key().id()).run()
        db.delete(edges)

        http = httplib2.Http()
        plus = build('plus', 'v1', http=http)
        user.google_credentials.authorize(http)
        friends = plus.people().list(userId='me', collection='visible').execute()
        for google_friend in friends.get('items'):
            # Determine if the friend from Google is a user of our app
            friend = model.User.all().filter('google_user_id = ',
                                             google_friend.get('id')).get()
            # Only store edges for friends who are users of our app
            if friend is not None:
                edge = model.DirectedUserToUserEdge()
                edge.owner_user_id = user.key().id()
                edge.friend_user_id = friend.key().id()
                edge.put()

    def post(self):
        """Exposed as `POST /api/connect`.

        Takes the following payload in the request body.  The payload represents
        all of the parameters that are required to authorize and connect the user
        to the app.
        {
          'state':'',
          'access_token':'',
          'token_type':'',
          'expires_in':'',
          'code':'',
          'id_token':'',
          'authuser':'',
          'session_state':'',
          'prompt':'',
          'client_id':'',
          'scope':'',
          'g_user_cookie_policy':'',
          'cookie_policy':'',
          'issued_at':'',
          'expires_at':'',
          'g-oauth-window':''
        }

        Returns the following JSON response representing the User that was
        connected:
        {
          'id':0,
          'googleUserId':'',
          'googleDisplayName':'',
          'googlePublicProfileUrl':'',
          'googlePublicProfilePhotoUrl':'',
          'googleExpiresAt':0
        }

        Issues the following errors along with corresponding HTTP response codes:
        401: The error from the Google token verification end point.
        500: 'Failed to upgrade the authorization code.' This can happen during
             OAuth v2 code exchange flows.
        500: 'Failed to read token data from Google.'
             This response also sends the error from the token verification
             response concatenated to the error message.
        500: 'Failed to query the Google+ API: '
             This error also includes the error from the client library
             concatenated to the error response.
        500: 'IOException occurred.' The IOException could happen when any
             IO-related errors occur such as network connectivity loss or local
             file-related errors.
        """
        # Only connect a user that is not already connected.
        if self.session.get(self.CURRENT_USER_SESSION_KEY) is not None:
            user = self.get_user_from_session()
            self.send_success(user)
            return

        credentials = None
        try:
            connect_credentials = json.loads(self.request.body)
            if 'error' in connect_credentials:
                self.send_error(401, connect_credentials.error)
                return
            if connect_credentials.get('code'):
                credentials = ConnectHandler.exchange_code(
                    connect_credentials.get('code'))
            elif connect_credentials.get('access_token'):
                credentials = ConnectHandler.create_credentials(connect_credentials)
        except FlowExchangeError:
            self.send_error(401, 'Failed to exchange the authorization code.')
            return

        # Check that the token is valid and gather some other information.
        token_info = ConnectHandler.get_token_info(credentials)
        if token_info.status_code != 200:
            self.send_error(401, 'Failed to validate access token.')
            return
        logging.debug("TokenInfo: " + token_info.content)
        token_info = json.loads(token_info.content)
        # If there was an error in the token info, abort.
        if token_info.get('error') is not None:
            self.send_error(401, token_info.get('error'))
            return
            # Make sure the token we got is for our app.
        expr = re.compile("(\d*)(.*).apps.googleusercontent.com")
        issued_to_match = expr.match(token_info.get('issued_to'))
        local_id_match = expr.match(CLIENT_ID)
        if (not issued_to_match
            or not local_id_match
            or issued_to_match.group(1) != local_id_match.group(1)):
            self.send_error(401, "Token's client ID does not match app's.")
            return

        # Store our credentials with in the datastore with our user.
        user = ConnectHandler.save_token_for_user(token_info.get('user_id'),
                                                  credentials)

        # Fetch the friends for this user from Google, and save them.
        ConnectHandler.get_and_store_friends(user)

        # Store the user ID in the session for later use.
        self.session[self.CURRENT_USER_SESSION_KEY] = token_info.get('user_id')

        self.send_success(user)


class DisconnectHandler(JsonRestHandler, SessionEnabledHandler):
    """Provides an API to disconnect users from AffordableCulture.

    This handler provides the /api/disconnect endpoint, and exposes the following
    operations:
      POST /api/disconnect
    """

    @staticmethod
    def revoke_token(credentials):
        """Revoke the given access token, and consequently any other access tokens
        and refresh tokens issued for this user to this app.

        Essentially this operation disconnects a user from the app, but keeps
        their app activities alive in Google.  The same user can later come back
        to the app, sign-in, re-consent, and resume using the app.
        throws RevokeException error occurred while making request.
        """
        url = TOKEN_REVOKE_ENDPOINT % credentials.access_token
        http = httplib2.Http()
        credentials.authorize(http)
        result = http.request(url, 'GET')[0]

        if result['status'] != '200':
            raise RevokeException

    def post(self):
        """Exposed as `POST /api/disconnect`.

        As required by the Google+ Platform Terms of Service, this end-point:

          1. Deletes all data retrieved from Google that is stored in our app.
          2. Revokes all of the user's tokens issued to this app.

        Takes no request payload, and disconnects the user currently identified
        by their session.

        Returns the following JSON response representing the User that was
        connected:

          'Successfully disconnected.'

        Issues the following errors along with corresponding HTTP response codes:
        401: 'Unauthorized request'.  No user was connected to disconnect.
        500: 'Failed to revoke token for given user: '
             + error from failed connection to revoke end-point.
        """
        try:
            user = self.get_user_from_session()
            credentials = user.google_credentials

            del (self.session[self.CURRENT_USER_SESSION_KEY])
            user_id = user.key().id()
            db.delete(model.VoteWantToGo.all().filter("owner_user_id =", user_id).run())
            db.delete(model.Attraction.all().filter("owner_user_id =", user_id).run())
            db.delete(model.DirectedUserToUserEdge.all().filter(
                "owner_user_id =", user_id).run())
            db.delete(user)

            DisconnectHandler.revoke_token(credentials)
            self.send_success('Successfully disconnected.')
            return
        except UserNotAuthorizedException as e:
            self.send_error(401, e.msg)
            return
        except RevokeException as e:
            self.send_error(500, e.msg)
            return


class AttractionsHandler(JsonRestHandler, SessionEnabledHandler,
                    blobstore_handlers.BlobstoreUploadHandler):
    """Provides an API for working with Attractions.

    This handler provides the /api/photos endpoint, and exposes the following
    operations:
      GET /api/attractions

      GET /api/attractions?attractionId=1234
      GET /api/attractions?categoryId=1234
      GET /api/attractions?ll=48.719493,9.261718&z=12

      GET /api/attractions?userId=me
      GET /api/attractions?categoryId=1234&userId=me
      GET /api/attractions?categoryId=1234&userId=me&friends=true
      POST /api/attractions
      DELETE /api/attractions?attractionId=1234
    """

    def get(self):
        """Exposed as `GET /api/attractions`.

        Accepts the following request parameters.

        'attractionId': id of the requested photo. Will return a single Photo.
        'categoryId': id of a theme. Will return the collection of photos for the
                   specified theme.
         'userId': id of the owner of the photo. Will return the collection of
                   photos for that user. The keyword 'me' can be used and will be
                   converted to the logged in user. Requires auth.
        'friends': value evaluated to boolean, if true will filter only photos
                   from friends of the logged in user. Requires auth.

        Returns the following JSON response representing a list of Photos.

        [
          {
            'id':0,
            'ownerUserId':0,
            'ownerDisplayName':'',
            'ownerProfileUrl':'',
            'ownerProfilePhoto':'',
            'themeId':0,
            'themeDisplayName':'',
            'numVotes':0,
            'voted':false, // Whether or not the current user has voted on this.
            'created':0,
            'fullsizeUrl':'',
            'thumbnailUrl':'',
            'voteCtaUrl':'', // URL for Vote interactive post button.
            'photoContentUrl':'' // URL for Google crawler to hit to get info.
          },
          ...
        ]

        Issues the following errors along with corresponding HTTP response codes:
        401: 'Unauthorized request' (if certain parameters are present in the
        request)
        """
        try:
            attraction_id = self.request.get('attractionId')
            category_id = self.request.get('categoryId')
            latlong = self.request.get('ll')
            zoom = self.request.get('z')
            search_query = self.request.get('q')

            user_id = self.request.get('userId')
            show_friends = bool(self.request.get('friends'))
            query = model.Attraction.all()
            #get by attractions id
            if attraction_id:
                attraction = model.Attraction.get_by_id(long(attraction_id))

                if attraction.approved:
                    self.send_success(attraction)
                else:
                    self.send_error(404, 'location is not approved')
                return

            if latlong:

                latlong = self.request.get('ll')
                zoom = self.request.get('z')

            #get by attractions id
            if user_id:
                if user_id == 'me':
                    user = self.get_user_from_session()
                else:
                    user = model.User.get_by_id(long(user_id))
                if show_friends:
                    user = self.get_user_from_session()
                    friends = user.get_friends()
                    if len(friends) > 0:
                        query = query.filter('owner_user_id in', friends[0:30])
                    else:
                        self.send_success([])
                        return
                else:
                    query = query.filter('owner_user_id =', user.key().id())

            #get by category id
            if category_id:
                query = query.filter('category_id =', long(category_id))

            attractions = list(query.run())

            user = None
            if self.session.get(self.CURRENT_USER_SESSION_KEY) is not None:
                if not user_id:
                    user = self.get_user_from_session()

                votes = model.VoteWantToGo.all().filter(
                    "owner_user_id =", user.key().id()).run()
                photo_votes = []
                for vote in votes:
                    photo_votes.append(vote.photo_id)
                for attraction in attractions:
                    attraction.voted = attraction.key().id() in photo_votes

            self.send_success(attractions, jsonkind='affcult#attractions')
        except TypeError as te:
            self.send_error(404, "Resource not found")
        except UserNotAuthorizedException as e:
            self.send_error(401, e.msg)

    def post(self):
        """Exposed as `POST /api/attractions`.

        Takes the following payload in the request body.  Payload represents a
        Photo that should be created.
        {
          'id':0,
          'ownerUserId':0,
          'ownerDisplayName':'',
          'ownerProfileUrl':'',
          'ownerProfilePhoto':'',
          'themeId':0,
          'themeDisplayName':'',
          'numVotes':0,
          'voted':false, // Whether or not the current user has voted on this.
          'created':0,
          'fullsizeUrl':'',
          'thumbnailUrl':'',
          'voteCtaUrl':'', // URL for Vote interactive post button.
          'photoContentUrl':'' // URL for Google crawler to hit to get info.
        }

        Returns the following JSON response representing the created Photo.
        {
          'id':0,
          'ownerUserId':0,
          'ownerDisplayName':'',
          'ownerProfileUrl':'',
          'ownerProfilePhoto':'',
          'themeId':0,
          'themeDisplayName':'',
          'numVotes':0,
          'voted':false, // Whether or not the current user has voted on this.
          'created':0,
          'fullsizeUrl':'',
          'thumbnailUrl':'',
          'voteCtaUrl':'', // URL for Vote interactive post button.
          'photoContentUrl':'' // URL for Google crawler to hit to get info.
        }

        Issues the following errors along with corresponding HTTP response codes:
        400: 'Bad Request' if the request is missing image data.
        401: 'Unauthorized request' (if certain parameters are present in the
             request)
        401: 'Access token expired' (there is a logged in user, but he doesn't
             have a refresh token and his access token is expiring in less than
             100 seconds, get a new token and retry)
        500: 'Error while writing app activity: ' + error from client library.
        """

        logging.debug('/api/attractions')

        try:
            user = self.get_user_from_session()
            logging.debug('debug')
            #current_theme = model.Category.get_current_theme()

            current_category = model.Category.all().filter('name =', self.request.get('category')).get()
            if current_category is None:
                current_category = model.Category(name=self.request.get('category')).put()

            if current_category:
                #uploads = self.get_uploads('image')
                #blob_info = uploads[0]
                attraction = model.Attraction(owner_user_id=user.key().id(),
                                        owner_display_name=user.google_display_name,
                                        owner_profile_photo=user.google_public_profile_photo_url,
                                        owner_profile_url=user.google_public_profile_url,
                                        #theme_id=current_theme.key().id(),
                                        categories=[current_category.name],
                                        theme_display_name=current_category.name,
                                        created=datetime.datetime.now(),
                                        num_votes=0,
                                        #image_blob_key=blob_info.key()
                                        country=self.request.get('country'),
                                        city=self.request.get('city'),
                                        name=self.request.get('name'),
                                        # Group affiliation
                                        #category = self.request.get('category'),
                                        address=self.request.get('address'),
                                        latlong=self.request.get('latlong'),
                                        free_time=self.request.get('free_time'),
                                        donation=self.request.get('donation'),
                                        website=self.request.get('website'),
                                        source=self.request.get('source'),
                                        email=self.request.get('email')
                )
                attraction.put()
                logging.debug('redirect:/api/attractions?attractionId=')
                try:
                    result = self.add_attraction_to_google_plus_activity(user, attraction)
                    logging.debug('redirect:/api/attractions?attractionId=%s' % result.id)
                    self.redirect('/api/attractions?attractionId=%s' % result.id)
                except apiclient.errors.HttpError as e:
                    logging.error("Error while writing app activity: %s", str(e))
                self.send_success(attraction)
            else:
                self.send_error(404, 'No current category.')
        except UserNotAuthorizedException as e:
            self.send_error(401, e.msg)

    def delete(self):
        """Exposed as `DELETE /api/attractions`.

        Accepts the following request parameters.

        'attractionId': id of the photo to delete.

        Returns the following JSON response representing success.
        'Photo successfully deleted.'

        Issues the following errors along with corresponding HTTP response codes:
        401: 'Unauthorized request' (if certain parameters are present in the
             request)
        404: 'Attraction with given ID does not exist.'
        """
        #TODO: Add test for admin
        try:
            user = self.get_user_from_session()
            photo_id = self.request.get('attractionId')
            if photo_id:
                attraction = model.Attraction.get_by_id(long(photo_id))
                if attraction.owner_user_id != user.key().id():
                    raise UserNotAuthorizedException
                attractionVotes = model.VoteWantToGo.all().filter(
                    "attraction_id =", attraction.key().id()).run()
                db.delete(attraction)
                db.delete(attractionVotes)
                self.send_success(model.Message(message="Attraction successfully deleted"))
            else:
                raise NotFoundException
        except NotFoundException as nfe:
            self.send_error(404, nfe.msg)
        except TypeError as te:
            self.send_error(404, "Resource not found")
        except UserNotAuthorizedException as e:
            self.send_error(401, e.msg)

    def add_attraction_to_google_plus_activity(self, user, attraction):
        """Creates an app activity in Google indicating that the given User has
        uploaded the given Photo.

        Args:
          user: Creator of Photo.
          attraction: Attraction itself.
        """
        activity = {"type": "http://schemas.google.com/AddActivity",
                    "target": {
                        "url": attraction.attraction_content_url
                    }}
        logging.debug("activity: " + str(activity))
        http = httplib2.Http()
        plus = build('plus', 'v1', http=http)
        if user.google_credentials:
            http = user.google_credentials.authorize(http)
        return plus.moments().insert(userId='me', collection='vault',
                                     body=activity).execute()


class InitHandler(JsonRestHandler, SessionEnabledHandler,
                    blobstore_handlers.BlobstoreUploadHandler):
    """Provides an API for working with Themes.

    This handler provides the /api/themes end-point, and exposes the following
    operations:
      GET /api/categories
    """

    def get(self):
        """Exposed as `GET /api/categories`.

        When requested, if no theme exists for the current day, then a theme with
        the name of 'Beautiful' is created for today.  This leads to multiple
        themes with the name 'Beautiful' if you use the app over multiple days
        without changing this logic.  This behavior is purposeful so that the app
        is easier to get up and running.

        Returns the following JSON response representing a list of Themes.

        [
          {
            'id':0,
            'displayName':'',
            'created':0,
            'start':0
          },
          ...
        ]
        """
        user = self.get_user_from_session()
        deferred.defer(initAttractions, user=user)
        self.send_success({'result': 'success'})

    def initCategories(self):
        #category = list(model.Category.all().order('-start').run())

        categories = 'unknown,Museum,Memorial,Zoo,Botanical garden,Park,Church,Factory,Library'.split(',')
        default_category = {}

        for category in categories:
            print category
            q = db.Query(model.Category)
            q.filter("category=", category)
            category_db = q.fetch(1)
            print category_db
            if not category_db:
                default_category = model.Category(name=category)
                #default_theme.start = default_theme.created
                default_category.put()

        self.send_success(default_category, jsonkind="affcult#category")


def initAttractions(user):

    attractions = []

    url = 'https://script.google.com/macros/s/AKfycbyqNWGDg6DlSHt2f-5ZVTFzsjGHQNdh60t0Wyi8Y5iVh3D9JC8/exec'

    result = urlfetch.fetch(url)
    if result.status_code == 200:
        attractions = json.loads(result.content)

    #user = self.get_user_from_session()

    validated_categories = []
    approved = False
    for attraction in attractions:

        if not 'category' in attraction:
            logging.critical('Missing category')
            continue
        categories = attraction['category'].split(',')

        for category in categories:
            if category in validated_categories:
                break

            try:
                current_category = model.Category.all().filter('name =', category).get()
                if current_category is None:
                    current_category = model.Category(name=category).put()

                validated_categories.append(category)
            except:
                logging.critical('Missing category:%s' % attraction)
                continue

        if not 'address' in attraction:
            logging.critical('Missing address')
            continue

        if not 'source' in attraction:
            logging.critical('Missing source')
            continue

        if not 'latlng' in attraction:
            logging.critical('Missing address')
            continue

        if not 'free_time' in attraction:
            attraction['free_time'] = None
        if not 'donation' in attraction:
            attraction['donation'] = None
        if not 'email' in attraction:
            attraction['email'] = None
        if not 'free_time' in attraction:
            attraction['free_time'] = None

        approved = True

        if current_category:
            #uploads = self.get_uploads('image')
            #blob_info = uploads[0]
            attraction = model.Attraction(owner_user_id=user.key().id(),
                                    owner_display_name=user.google_display_name,
                                    owner_profile_photo=user.google_public_profile_photo_url,
                                    owner_profile_url=user.google_public_profile_url,
                                    #theme_id=current_theme.key().id(),
                                    categories=categories,
                                    theme_display_name=current_category.name,
                                    created=datetime.datetime.now(),
                                    approved=approved,
                                    num_votes=0,
                                    #image_blob_key=blob_info.key()
                                    country=attraction['country'],
                                    city=attraction['city'],
                                    name=attraction['name'],
                                    # Group affiliation
                                    #category = attraction['category'),
                                    address=attraction['address'],
                                    latlong=attraction['latlng'],
                                    free_time=attraction['free_time'],
                                    donation=attraction['donation'],
                                    website=attraction['website'],
                                    source=attraction['source'],
                                    email=attraction['email']
            )
            attraction.put()
            logging.debug('redirect:/api/attractions?attractionId=')



class CategoriesHandler(JsonRestHandler):
    """Provides an API for working with Themes.

    This handler provides the /api/themes end-point, and exposes the following
    operations:
      GET /api/categories
    """

    def get(self):
        """Exposed as `GET /api/categories`.

        When requested, if no theme exists for the current day, then a theme with
        the name of 'Beautiful' is created for today.  This leads to multiple
        themes with the name 'Beautiful' if you use the app over multiple days
        without changing this logic.  This behavior is purposeful so that the app
        is easier to get up and running.

        Returns the following JSON response representing a list of Themes.

        [
          {
            'id':0,
            'displayName':'',
            'created':0,
            'start':0
          },
          ...
        ]
        """
        #category = list(model.Category.all().order('-start').run())
        #categories = list(model.Category.all().run(projection='name'))
        #categories = list(db.Query(model.Category, projection=('ID', 'name')).run())
        #categories = list(db.Query(model.Category, projection='name').run())
        q = db.Query(model.Category)
        q.order('created')
        categories = q.fetch(100, projection=('name',))

        if not categories:
            default_category = model.Category(name="Museum")
            #default_theme.start = default_theme.created
            default_category.put()
            categories = [default_category]
        self.send_success(categories, jsonkind="affcult#category")


class SchemaHandler(JsonRestHandler, SessionEnabledHandler):
    """Returns metadata for an image for user when writing moments."""

    def get(self):
        """Returns the template at templates/${request.path}.

           Issues the following errors along with corresponding HTTP response codes:
           404: 'Not Found'. No template was found for the specified path.
        """
        try:
            photo_id = self.request.get('attractionId')
            self.response.headers['Content-Type'] = 'text/html'
            template = JINJA_ENV.get_template('templates' + self.request.path)
            if photo_id:
                photo = model.Attraction.get_by_id(long(photo_id))
                self.response.out.write(template.render({
                    'attractionId': photo_id,
                    'redirectUrl': 'add_attraction_new.html?attractionId={}'.format(photo_id),
                    'name': 'Attraction by {} for {} | AffordableCulture'.format(
                        photo.owner_display_name,
                        photo.theme_display_name),
                    'imageUrl': photo.thumbnail_url,
                    'description': '{} needs your vote to win this hunt.'.format(
                        photo.owner_display_name)
                }))
            else:
                photo = model.Attraction.all().get()
                if photo:
                    self.response.out.write(template.render({
                        'redirectUrl': 'add_attraction_new.html?attractionId='.format(photo_id),
                        'name': 'Attraction by {} for {} | AffordableCulture'.format(
                            photo.owner_display_name,
                            photo.theme_display_name),
                        'imageUrl': photo.thumbnail_url,
                        'description': 'Join in the AffordableCulture.'
                    }))
                else:
                    self.response.out.write(template.render({
                        'redirectUrl': get_base_url(),
                        'name': 'AffordableCulture',
                        'imageUrl': '{}/images/interactivepost-icon.png'.format(
                            get_base_url()),
                        'description': 'Join in the AffordableCulture.'
                    }))
        except TypeError as te:
            self.send_error(404, "Resource not found")


class MainHandler(webapp2.RequestHandler):
    """A handler for showing an HTML form."""

    def get(self):
        """Render an HTML form for creating Memes."""
        template = JINJA_ENV.get_template('add_attraction.html')
        nickname, link_url, link_text = get_login_logout_context(
            self.request.uri)
        context = {
            'nickname': nickname,
            'link_text': link_text,
            'link_url': link_url,
            'CLIENT_ID': '622222016553.apps.googleusercontent.com'
        }
        self.response.out.write(template.render(context))


def get_login_logout_context(target_url):
    """Returns nickname, link url and link text for the common_header.html."""
    user = users.get_current_user()
    if user:
        nickname = user.nickname()
        link_text = 'Logout'
        link_url = users.create_logout_url(target_url)
    else:
        nickname = 'Anonymous user'
        link_text = 'Login'
        link_url = users.create_login_url(target_url)
    return nickname, link_url, link_text

routes = [
    ('/admin/init', InitHandler),
    ('/api/connect', ConnectHandler),
    ('/api/disconnect', DisconnectHandler),
    ('/api/categories', CategoriesHandler),
    ('/api/attractions', AttractionsHandler),
    ('/admin/attractions/add', MainHandler),
    ('/photo.html', SchemaHandler)
]
config = {}
config['webapp2_extras.sessions'] = {
    'secret_key': 'YOUR_SESSION_SECRET'
}
app = webapp2.WSGIApplication(routes, config=config, debug=True)
