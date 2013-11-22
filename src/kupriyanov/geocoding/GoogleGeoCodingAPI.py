# -*- coding: utf-8 -*-

from google.appengine.api import urlfetch
from kupriyanov.caching.gae_memcache_decorator import cached

__author__ = 'cr'

import urllib
import logging

logger = logging.getLogger("doood")


class GoogleGeoCodingAPI(object):
    """
    classdocs
    """

    def __init__(self):
        '''
        Constructor
        '''
        pass

    @cached("geocode", time=3600)
    def doGeocode(self, location):
        logger.info('location:%s' % location)

        if not location:
            raise Exception('empty search string')
        result = None

        location = unicode(location).encode('utf-8')
        location = urllib.quote(location)

        url = 'https://maps.googleapis.com/maps/api/geocode/json?&address=%s&sensor=true' % location

        logger.info('url:%s', url)
        try:
            result = urlfetch.fetch(url)
            if result.status_code == 200:
                result = result.content
                logging.info('result:%s' % result)
            else:
                raise Exception('wrong status:%s' % result.status_code)
        except Exception, e:
            logger.error('Failed to fetch url[%s]:%s:%s' % (result.status_code, url, result.content))
            raise Exception(e.message)

        return result