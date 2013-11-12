#!/usr/bin/python2.5
#
# Copyright 2009 Roman Nurik
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Service /s/* request handlers."""

__author__ = 'api.roman.public@gmail.com (Roman Nurik)'

import os
import sys
import wsgiref.handlers
import json
import logging

from google.appengine.ext import db
from google.appengine.ext import webapp

import model
from geo import geotypes


def _merge_dicts(*args):
    """Merges dictionaries right to left. Has side effects for each argument."""
    return reduce(lambda d, s: d.update(s) or d, args)


class SearchAttractionsService:
    """Handler for public school search requests."""

    def search(self, query_type='proximity', params=None):
        logging.critical('search')

        if not query_type in ['proximity', 'bounds']:
            raise Exception('type parameter must be '
                            'one of "proximity", "bounds".',
                            code=400)

        center = None
        bounds = None
        if query_type == 'proximity':
            try:
                center = geotypes.Point(float(params['lat']),
                                        float(params['lon']))
            except ValueError:
                raise Exception('lat and lon parameters must be valid latitude '
                                'and longitude values.')
        elif query_type == 'bounds':
            try:
                bounds = geotypes.Box(float(params['north']),
                                      float(params['east']),
                                      float(params['south']),
                                      float(params['west']))
            except ValueError:
                raise Exception('north, south, east, and west parameters must be '
                                'valid latitude/longitude values.')

        max_results = 10
        if params['maxresults']:
            max_results = int(params['maxresults'])

        max_distance = 80000 # 80 km ~ 50 mi
        if params['maxdistance']:
            max_distance = float(params['maxdistance'])

        category = params['category']

        try:
            # Can't provide an ordering here in case inequality filters are used.
            base_query = model.Attraction.all()

            if category:
                base_query.filter('category =', category)

            # Natural ordering chosen to be public school enrollment.
            #base_query.order('-enrollment')

            # Perform proximity or bounds fetch.
            results = []
            if query_type == 'proximity':
                results = model.Attraction.proximity_fetch(
                    base_query,
                    center, max_results=max_results, max_distance=max_distance)
            elif query_type == 'bounds':
                results = model.Attraction.bounding_box_fetch(
                    base_query,
                    bounds, max_results=max_results)

            logging.critical(results)

            return results
            # public_attrs = model.Attraction.public_attributes()
            #
            # results_obj = [
            #     _merge_dicts({'lat': result.location.lat,
            #                   'lng': result.location.lon
            #                   },
            #                  dict([(attr, getattr(result, attr))
            #                        for attr in public_attrs]))
            #     for result in results]
            #
            # return results_obj
        except:
            raise Exception(str(sys.exc_info()[1]), code=500)
