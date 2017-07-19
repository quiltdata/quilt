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

mp_token = app.config['MIXPANEL_PROJECT_TOKEN']
if mp_token:
    mp_consumer = AsyncConsumer()
    atexit.register(mp_consumer.shutdown)
else:
    # For testing, dev, etc.
    mp_consumer = NoopConsumer()

mp = Mixpanel(app.config['MIXPANEL_PROJECT_TOKEN'], mp_consumer)
