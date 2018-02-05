# Copyright (c) 2017 Quilt Data, Inc. All rights reserved.

"""
Analytics code: Mixpanel, async consumer.
"""

import atexit
from concurrent.futures import ThreadPoolExecutor

from mixpanel import Consumer, Mixpanel

from . import app

MIXPANEL_EVENT = 'SERVER'


class AsyncConsumer(object):
    """
    Wrapper around mixpanel.Consumer that sends messages in a background thread.
    """
    def __init__(self):
        self._consumer = Consumer()
        self._executor = ThreadPoolExecutor(max_workers=1)

    def send(self, endpoint, json_message):
        """
        Queues the message to be sent.
        """
        self._executor.submit(self._consumer.send, endpoint, json_message)

    def shutdown(self):
        """
        Shuts down the background thread.
        """
        self._executor.shutdown(wait=True)

class NoopConsumer(object):
    def send(self, endpoint, json_message):
        pass

# By default, MixPanel is enabled - but can be turned off by setting the token to an empty string.
# `None` means, use the default token.
mp_token = app.config.get('MIXPANEL_PROJECT_TOKEN')
if mp_token is None:
    mp_token = 'fd57644e08f13d8e569e5a95a0c81b3b'

if mp_token:
    mp_consumer = AsyncConsumer()
    atexit.register(mp_consumer.shutdown)
else:
    # For testing, dev, etc.
    mp_consumer = NoopConsumer()

mp = Mixpanel(mp_token, mp_consumer)
