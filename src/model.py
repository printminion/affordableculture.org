#!/usr/bin/python

"""Persistent datamodel for AffordableCulture."""

import json
import logging
import random
import re
import string
import datetime
import types
import handlers
from apiclient.discovery import build
from google.appengine.api import images

from google.appengine.ext import db
from google.appengine.ext import blobstore
from oauth2client.appengine import CredentialsProperty
from geo.geomodel import GeoModel


class JsonifiableEncoder(json.JSONEncoder):
    """JSON encoder which provides a convenient extension point for custom JSON
    encoding of Jsonifiable subclasses.
    """

    def default(self, obj):
        if isinstance(obj, Jsonifiable):
            result = json.loads(obj.to_json())
            return result
        return json.JSONEncoder.default(self, obj)


class Jsonifiable:
    """Base class providing convenient JSON serialization and deserialization
    methods.
    """
    jsonkind = 'affcult#jsonifiable'

    @staticmethod
    def lower_first(key):
        """Make the first letter of a string lower case."""
        return key[:1].lower() + key[1:] if key else ''

    @staticmethod
    def transform_to_camelcase(key):
        """Transform a string underscore separated words to concatenated camel case.
        """
        return Jsonifiable.lower_first(
            ''.join(c.capitalize() or '_' for c in key.split('_')))

    @staticmethod
    def transform_from_camelcase(key):
        """Tranform a string from concatenated camel case to underscore separated
        words.
        """
        s1 = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', key)
        return re.sub('([a-z0-9])([A-Z])', r'\1_\2', s1).lower()

    def to_dict(self):
        """Returns a dictionary containing property values for the current object
        stored under the property name in camel case form.
        """
        result = {}
        for p in self.json_properties():
            value = getattr(self, p)
            if isinstance(value, datetime.datetime):
                value = value.strftime('%s%f')[:-3]
            elif isinstance(value, db.GeoPt):
                value = {'lat': value.lat, 'lon': value.lon}
            result[Jsonifiable.transform_to_camelcase(p)] = value
        return result

    def to_json(self):
        """Returns a JSON string of the properties of this object."""
        properties = self.to_dict()
        if isinstance(self, db.Model):
            properties['id'] = unicode(self.key().id())
        return json.dumps(properties)

    def json_properties(self):
        """Returns a default list properties for this object that should be
        included when serializing this object to, or deserializing it from, JSON.

        Subclasses can customize the properties by overriding this method.
        """
        attributes = []
        all = vars(self)
        for var in all:
            if var[:1] != '_':
                attributes.append(var)
        if isinstance(self, db.Model):
            properties = self.properties().keys()
            for property in properties:
                if property[:1] != '_':
                    attributes.append(property)
        return attributes

    def from_json(self, json_string):
        """Sets properties on this object based on the JSON string supplied."""
        o = json.loads(json_string)
        properties = {}
        if isinstance(self, db.Model):
            properties = self.properties()
        for key, value in o.iteritems():
            property_value = value
            property_key = Jsonifiable.transform_from_camelcase(key)
            if property_key in properties.keys():
                if properties[property_key].data_type == types.IntType:
                    property_value = int(value)
            self.__setattr__(property_key, property_value)


class DirectedUserToUserEdge(db.Model, Jsonifiable):
    """Represents friend links between PhotoHunt users."""
    owner_user_id = db.IntegerProperty()
    friend_user_id = db.IntegerProperty()


class Attraction(GeoModel, Jsonifiable):
    """Represents a user submitted Attraction."""
    jsonkind = 'affcult#attraction'
    DEFAULT_THUMBNAIL_SIZE = 400
    fullsize_url = None
    thumbnail_url = None
    attraction_content_url = None

    vote_cta_url = db.StringProperty()
    vote_been_url = db.StringProperty()

    num_votes_want_to_go = db.IntegerProperty()
    num_votes_been_there = db.IntegerProperty()

    voted_want_togo = False
    voted_been_there = False

    approved = db.BooleanProperty(default=False)

    country = db.StringProperty()
    city = db.StringProperty()
    name = db.StringProperty()
    # Group affiliation
    #category = db.ListProperty(db.Key)
    categories = db.ListProperty(str, indexed=False, default=[])

    address = db.PostalAddressProperty()
    #latlong = db.GeoPtProperty()
    free_time = db.StringProperty()
    donation = db.StringProperty()
    website = db.LinkProperty()
    source = db.LinkProperty()
    email = db.EmailProperty()

    owner_user_id = db.IntegerProperty()
    owner_display_name = db.StringProperty()
    owner_profile_url = db.StringProperty()
    owner_profile_photo = db.StringProperty()
    #theme_id = db.IntegerProperty()
    #theme_display_name = db.StringProperty()
    image_blob_key = blobstore.BlobReferenceProperty()
    created = db.DateTimeProperty(auto_now_add=True)

    url_wikipedia = db.LinkProperty()
    url_gpl = db.LinkProperty()
    url_tripadvisor = db.LinkProperty()
    url_yelp = db.LinkProperty()
    url_facebook = db.LinkProperty()
    url_twitter = db.LinkProperty()
    url_youtube = db.LinkProperty()
    url_instagram = db.LinkProperty()
    url_android = db.LinkProperty()
    url_ios = db.LinkProperty()

    def __init__(self, *args, **kwargs):
        db.Model.__init__(self, *args, **kwargs)
        self._setup()

    def put(self, **kwargs):
        db.Model.put(self, **kwargs)
        self._setup()

    def _setup(self):
        """Populate transient fields after load or initialization."""
        if self.image_blob_key:
            self.fullsize_url = self.get_image_url()
            self.thumbnail_url = self.get_image_url(self.DEFAULT_THUMBNAIL_SIZE)

        if self.is_saved():
            key = self.key()

            self.num_votes_want_to_go = VoteWantToGo.all().filter("attraction_id =", key.id()).count()
            self.num_votes_been_there = VoteBeenHere.all().filter("attraction_id =", key.id()).count()

            template = '%s/attraction.html?attractionId=%s%s'

            self.vote_cta_url = template % (handlers.get_base_url(), key.id(), '&action=VOTEWANTTOGO')
            self.vote_been_url = template % (handlers.get_base_url(), key.id(), '&action=VOTEBEENTHERE')

            template = '%s/attraction.html?attractionId=%s'
            self.attraction_content_url = template % (handlers.get_base_url(), key.id())
        else:
            self.num_votes_want_to_go = 0
            self.num_votes_been_there = 0

    def json_properties(self):
        """Hide image_blob_key from JSON serialization."""
        properties = Jsonifiable.json_properties(self)
        properties.remove('image_blob_key')
        return properties

    def get_image_url(self, size=None):
        """Return the image serving url for this Photo."""
        return images.get_serving_url(self.image_blob_key, size=size)

    @staticmethod
    def public_attributes():
        """Returns a set of simple attributes on public school entities."""
        return ['id', 'name', 'address', 'city']

    def _get_latitude(self):
        return self.location.lat if self.location else None

    def _set_latitude(self, lat):
        if not self.location:
            self.location = db.GeoPt()

        self.location.lat = lat

        latitude = property(self._get_latitude, self._set_latitude)

    def _get_longitude(self):
        return self.location.lon if self.location else None

    def _set_longitude(self, lon):
        if not self.location:
            self.location = db.GeoPt()

        self.location.lon = lon

        longitude = property(self._get_longitude, self._set_longitude)


class Category(db.Model, Jsonifiable):
    """Represents a affcult theme."""
    jsonkind = 'affcult#category'
    name = db.StringProperty()
    created = db.DateTimeProperty(auto_now_add=True)
    #start = db.DateTimeProperty()
    #preview_photo_id = db.IntegerProperty()
    @property
    def members(self):
        return Category.gql("WHERE category = :1", self.key())

    # @staticmethod
    # def get_current_theme():
    #     """Query the current theme based on the date."""
    #     today = db.datetime.date.today()
    #     start = db.datetime.datetime(today.year, today.month, today.day, 0, 0, 0)
    #     end = db.datetime.datetime(today.year, today.month, today.day, 23, 59, 59)
    #     return Category.all().filter('start >=', start).filter('start <', end).order('-start').get()


class User(db.Model, Jsonifiable):
    """Represents a affcult user."""
    jsonkind = 'affcult#user'
    email = db.EmailProperty()
    google_user_id = db.StringProperty()
    google_display_name = db.StringProperty()
    google_public_profile_url = db.LinkProperty()
    google_public_profile_photo_url = db.LinkProperty()
    google_credentials = CredentialsProperty()

    def json_properties(self):
        """Hide google_credentials from JSON serialization."""
        properties = Jsonifiable.json_properties(self)
        properties.remove('google_credentials')
        return properties

    def get_friends(self):
        """Query the friends of the current user."""
        edges = DirectedUserToUserEdge.all().filter(
            'owner_user_id =', self.key().id()).run()
        return db.get([db.Key.from_path('User', edge.friend_user_id) for edge in
                       edges])


class VoteWantToGo(db.Model, Jsonifiable):
    """Represents a vote case by a affcult user."""
    jsonkind = 'affcult#votewanttogo'
    owner_user_id = db.IntegerProperty()
    attraction_id = db.IntegerProperty()


class VoteBeenHere(db.Model, Jsonifiable):
    """Represents a vote case by a affcult user."""
    jsonkind = 'affcult#votebeenhere'
    owner_user_id = db.IntegerProperty()
    attraction_id = db.IntegerProperty()

class Message(Jsonifiable):
    """Standard JSON type used to return success/error messages."""
    jsonkind = 'affcult#message'
    message = ""

    def __init__(self, message):
        self.message = message


class UploadUrl(Jsonifiable):
    """Represents a affcult Upload URL."""
    jsonkind = 'affcult#uploadurl'
    url = ""

    def __init__(self, url):
        self.url = url
