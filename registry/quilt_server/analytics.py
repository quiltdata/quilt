# Copyright (c) 2017 Quilt Data, Inc. All rights reserved.

"""
Analytics code: Mixpanel, async consumer.
"""

from mixpanel import Consumer, Mixpanel

from . import app

try:
    from uwsgidecorators import spool
except ImportError:
    # Running using Flask in dev; just run everything synchronously.
    class spool(object):
        def __init__(self, func):
            self.func = func
        def spool(self, **args):
            assert app.debug
            self.func(args)


MIXPANEL_EVENT = 'SERVER'

_consumer_impl = Consumer()

@spool
def _send_event_task(args):
    """
    Actually sends the MixPanel event. Runs in a uwsgi worker process.
    """
    endpoint = args['endpoint']
    json_message = args['json_message']
    _consumer_impl.send(endpoint, json_message)


class AsyncConsumer(object):
    """
    Forwards MixPanel events to a task running in a background process.
    """
    def send(self, endpoint, json_message):
        """
        Queues the message to be sent.
        """
        _send_event_task.spool(endpoint=endpoint, json_message=json_message)


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
else:
    # For testing, dev, etc.
    mp_consumer = NoopConsumer()

mp = Mixpanel(mp_token, mp_consumer)
