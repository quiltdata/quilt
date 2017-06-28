"""
Payments tests
"""

import json
from unittest import mock

import requests
import stripe

from quilt_server.const import PaymentPlan
from .utils import mock_customer, QuiltTestCase


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
            '/api/profile',
            headers={
                'Authorization': user,
            }
        )
        assert resp.status_code == requests.codes.ok

        customer_create.assert_called_with(email='%s@example.com' % user, description=user)
        subscription_create.assert_called_with(customer='cus_1', plan=PaymentPlan.BASIC.value)
        customer_retrieve.assert_called_with('cus_1')

    @mock_customer(plan=PaymentPlan.BASIC, have_credit_card=False)
    def testBasicInfo(self, customer):
        user = 'test_user'
        resp = self.app.get(
            '/api/profile',
            headers={
                'Authorization': user,
            }
        )
        assert resp.status_code == requests.codes.ok
        data = json.loads(resp.data.decode('utf8'))

        assert data['plan'] == PaymentPlan.BASIC.value
        assert data['have_credit_card'] is False

    @mock_customer(plan=PaymentPlan.PRO, have_credit_card=True)
    def testProInfo(self, customer):
        resp = self.app.get(
            '/api/profile',
            headers={
                'Authorization': user,
            }
        )
        assert resp.status_code == requests.codes.ok
        data = json.loads(resp.data.decode('utf8'))

        assert data['plan'] == PaymentPlan.PRO.value
        assert data['have_credit_card'] is True

    @mock_customer(plan=PaymentPlan.BASIC, have_credit_card=True)
    def testUpdatePlan(self, customer):
        user = 'test_user'
        subscription = customer.subscriptions.data[0]
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
        assert not subscription.save.called

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
        assert subscription.plan == PaymentPlan.PRO.value
        subscription.save.assert_called_with()

    @mock_customer(plan=PaymentPlan.BASIC, have_credit_card=False)
    def testUpgradeNoPayment(self, customer):
        user = 'test_user'
        subscription = customer.subscriptions.data[0]
        subscription.save.return_value = None

        resp = self.app.post(
            '/api/payments/update_plan',
            data=dict(
                plan=PaymentPlan.PRO.value
            ),
            headers={
                'Authorization': user,
            }
        )
        assert resp.status_code == requests.codes.payment_required
        assert not subscription.save.called

    @mock_customer(plan=PaymentPlan.PRO, have_credit_card=False)
    def testDowngradeNoPayment(self, customer):
        user = 'test_user'
        subscription = customer.subscriptions.data[0]
        subscription.save.return_value = None

        resp = self.app.post(
            '/api/payments/update_plan',
            data=dict(
                plan=PaymentPlan.BASIC.value
            ),
            headers={
                'Authorization': user,
            }
        )
        assert resp.status_code == requests.codes.ok
        assert subscription.plan == PaymentPlan.BASIC.value
        subscription.save.assert_called_with()

    @mock_customer()
    def testUpdatePayment(self, customer):
        user = 'test_user'
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

        assert customer.source == token
        customer.save.assert_called_with()
