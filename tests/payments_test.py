"""
Payments tests
"""

import json
from unittest import mock

import requests
import stripe

from quilt_server.const import PaymentPlan
from .utils import QuiltTestCase


class PaymentsTestCase(QuiltTestCase):
    @mock.patch('stripe.Customer.retrieve')
    @mock.patch('stripe.Subscription.create')
    @mock.patch('stripe.Customer.create')
    def testNewUser(self, customer_create, subscription_create, customer_retrieve):
        user = 'test_user'

        customer_create.return_value.id = 'cus_1'
        subscription_create.return_value.id = 'sub_1'

        customer_retrieve.return_value.subscriptions.total_count = 1
        customer_retrieve.return_value.subscriptions.data[0].plan.id = PaymentPlan.BASIC.value
        customer_retrieve.return_value.sources.total_count = 0

        resp = self.app.get(
            '/api/payments/info',
            headers={
                'Authorization': user,
            }
        )
        assert resp.status_code == requests.codes.ok

        customer_create.assert_called_with(description=user)
        subscription_create.assert_called_with(customer='cus_1', plan=PaymentPlan.BASIC.value)
        customer_retrieve.assert_called_with('cus_1')

    @mock.patch('quilt_server.views._get_or_create_customer')
    def testInfo(self, get_customer):
        user = 'test_user'

        # Basic, no credit card.

        get_customer.return_value.subscriptions.total_count = 1
        get_customer.return_value.subscriptions.data[0].plan.id = PaymentPlan.BASIC.value
        get_customer.return_value.sources.total_count = 0

        resp = self.app.get(
            '/api/payments/info',
            headers={
                'Authorization': user,
            }
        )
        assert resp.status_code == requests.codes.ok
        data = json.loads(resp.data.decode('utf8'))

        assert data['plan'] == PaymentPlan.BASIC.value
        assert data['have_credit_card'] is False

        # Pro, with credit card.

        get_customer.return_value.subscriptions.data[0].plan.id = PaymentPlan.PRO.value
        get_customer.return_value.sources.total_count = 1

        resp = self.app.get(
            '/api/payments/info',
            headers={
                'Authorization': user,
            }
        )
        assert resp.status_code == requests.codes.ok
        data = json.loads(resp.data.decode('utf8'))

        assert data['plan'] == PaymentPlan.PRO.value
        assert data['have_credit_card'] is True

    @mock.patch('quilt_server.views._get_or_create_customer')
    def testUpdatePlan(self, get_customer):
        user = 'test_user'

        subscription = get_customer.return_value.subscriptions.data[0]
        subscription.save.return_value = None

        # Bad plan
        resp = self.app.post(
            '/api/payments/update_plan',
            data=dict(
                plan='foo'
            ),
            headers={
                'Authorization': user,
            }
        )
        assert resp.status_code == requests.codes.bad_request

        get_customer.assert_not_called()

        # Good plan
        resp = self.app.post(
            '/api/payments/update_plan',
            data=dict(
                plan=PaymentPlan.PRO.value
            ),
            headers={
                'Authorization': user,
            }
        )
        assert resp.status_code == requests.codes.ok

        get_customer.assert_called_with(user)
        assert subscription.plan == PaymentPlan.PRO.value
        subscription.save.assert_called_with()

    @mock.patch('quilt_server.views._get_or_create_customer')
    def testUpdatePayment(self, get_customer):
        user = 'test_user'

        customer = get_customer.return_value
        customer.save.return_value = None

        # No token
        resp = self.app.post(
            '/api/payments/update_payment',
            data=dict(
            ),
            headers={
                'Authorization': user,
            }
        )
        assert resp.status_code == requests.codes.bad_request
        get_customer.assert_not_called()

        # Bad token
        customer.save.side_effect = stripe.InvalidRequestError('Bad token!', None)

        resp = self.app.post(
            '/api/payments/update_payment',
            data=dict(
                token='foo'
            ),
            headers={
                'Authorization': user,
            }
        )
        assert resp.status_code == requests.codes.bad_request

        get_customer.assert_called_with(user)
        customer.save.assert_called_with()

        # Good token
        customer.save.side_effect = None
        token = '12345'

        resp = self.app.post(
            '/api/payments/update_payment',
            data=dict(
                token=token
            ),
            headers={
                'Authorization': user,
            }
        )
        assert resp.status_code == requests.codes.ok

        get_customer.assert_called_with(user)
        assert customer.source == token
        customer.save.assert_called_with()
