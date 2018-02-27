# Copyright (c) 2018 Quilt Data, Inc. All rights reserved.

"""
Payments tests for team deployments
"""

import json
from unittest import mock

import requests
import stripe

from quilt_server.const import PaymentPlan
from .utils import mock_customer, QuiltTestCase


@mock.patch('quilt_server.views.TEAM_ID', 'test_team')
class TeamPaymentsTestCase(QuiltTestCase):
    @mock.patch('quilt_server.views.HAVE_PAYMENTS', True)
    @mock.patch('stripe.Customer.retrieve')
    @mock.patch('stripe.Subscription.create')
    @mock.patch('stripe.Customer.create')
    def testNewTeam(self, customer_create, subscription_create, customer_retrieve):
        user1 = 'user1'
        user2 = 'user2'

        # Access the profile as the first user.
        customer_create.return_value.id = 'cus_1'
        subscription_create.return_value.id = 'sub_1'

        customer_retrieve.return_value.subscriptions.total_count = 1
        customer_retrieve.return_value.subscriptions.data[0].plan.id = PaymentPlan.TEAM_UNPAID.value
        customer_retrieve.return_value.sources.total_count = 0

        resp = self.app.get(
            '/api/profile',
            headers={
                'Authorization': user1,
            }
        )
        assert resp.status_code == requests.codes.ok

        customer_create.assert_called_with(email=None, description='Team test_team')
        subscription_create.assert_called_with(customer='cus_1', plan=PaymentPlan.TEAM_UNPAID.value)
        customer_retrieve.assert_called_with('cus_1')

        # Now access it as the second user, and verify that no customer gets created,
        # and the info is the same as before.
        customer_create.reset_mock()
        subscription_create.reset_mock()

        resp = self.app.get(
            '/api/profile',
            headers={
                'Authorization': user2,
            }
        )
        assert resp.status_code == requests.codes.ok

        customer_create.assert_not_called()
        subscription_create.assert_not_called()
        customer_retrieve.assert_called_with('cus_1')

    @mock_customer(plan=PaymentPlan.TEAM_UNPAID, have_credit_card=True)
    def testUpgrade(self, customer):
        admin = 'admin'
        subscription = customer.subscriptions.data[0]
        subscription.save.return_value = None

        resp = self.app.post(
            '/api/payments/update_plan',
            data=dict(
                plan=PaymentPlan.TEAM.value
            ),
            headers={
                'Authorization': admin,
            }
        )
        assert resp.status_code == requests.codes.ok
        data = json.loads(resp.data.decode('utf8'))
        assert data['plan'] == PaymentPlan.TEAM.value

        assert subscription.plan == PaymentPlan.TEAM.value
        subscription.save.assert_called_with()

    @mock_customer(plan=PaymentPlan.TEAM, have_credit_card=True)
    def testDowngrade(self, customer):
        admin = 'admin'
        subscription = customer.subscriptions.data[0]
        subscription.save.return_value = None

        resp = self.app.post(
            '/api/payments/update_plan',
            data=dict(
                plan=PaymentPlan.TEAM_UNPAID.value
            ),
            headers={
                'Authorization': admin,
            }
        )
        assert resp.status_code == requests.codes.ok
        data = json.loads(resp.data.decode('utf8'))
        assert data['plan'] == PaymentPlan.TEAM_UNPAID.value

        assert subscription.plan == PaymentPlan.TEAM_UNPAID.value
        subscription.save.assert_called_with()

    @mock_customer(plan=PaymentPlan.TEAM_UNPAID, have_credit_card=True)
    def testUpdatePlanInvalid(self, customer):
        admin = 'admin'
        subscription = customer.subscriptions.data[0]
        subscription.save.return_value = None

        resp = self.app.post(
            '/api/payments/update_plan',
            data=dict(
                plan=PaymentPlan.INDIVIDUAL.value
            ),
            headers={
                'Authorization': admin,
            }
        )
        assert resp.status_code == requests.codes.forbidden
        assert not subscription.save.called

    @mock_customer(plan=PaymentPlan.TEAM_UNPAID, have_credit_card=True)
    def testUpdatePlanNonAdmin(self, customer):
        user = 'user'
        subscription = customer.subscriptions.data[0]
        subscription.save.return_value = None

        resp = self.app.post(
            '/api/payments/update_plan',
            data=dict(
                plan=PaymentPlan.TEAM.value
            ),
            headers={
                'Authorization': user,
            }
        )
        assert resp.status_code == requests.codes.forbidden
        assert not subscription.save.called

    @mock_customer(plan=PaymentPlan.TEAM_UNPAID, have_credit_card=False)
    def testUpgradeNoPayment(self, customer):
        admin = 'admin'
        subscription = customer.subscriptions.data[0]
        subscription.save.return_value = None

        resp = self.app.post(
            '/api/payments/update_plan',
            data=dict(
                plan=PaymentPlan.TEAM.value
            ),
            headers={
                'Authorization': admin,
            }
        )
        assert resp.status_code == requests.codes.payment_required
        assert not subscription.save.called

    @mock_customer(plan=PaymentPlan.TEAM, have_credit_card=False)
    def testUpdatePayment(self, customer):
        admin = 'admin'
        customer.save.return_value = None
        token = '12345'

        resp = self.app.post(
            '/api/payments/update_payment',
            data=dict(
                token=token
            ),
            headers={
                'Authorization': admin,
            }
        )
        assert resp.status_code == requests.codes.ok

        assert customer.source == token
        customer.save.assert_called_with()

    @mock_customer(plan=PaymentPlan.TEAM, have_credit_card=False)
    def testUpdatePaymentNonAdmin(self, customer):
        user = 'user'
        customer.save.return_value = None
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
        assert resp.status_code == requests.codes.forbidden
