import IconButton from 'material-ui/IconButton';
import RaisedButton from 'material-ui/RaisedButton';
import { Toolbar, ToolbarGroup, ToolbarTitle } from 'material-ui/Toolbar';
import PropTypes from 'prop-types';
import React, { Fragment } from 'react';
import { FormattedMessage } from 'react-intl';
import StripeCheckout from 'react-stripe-checkout';
import { setPropTypes } from 'recompose';
import styled from 'styled-components';

import Loading from 'components/Loading';
import MIcon from 'components/MIcon';
import config from 'constants/config';
import { icon256 } from 'constants/urls';
import { composeComponent } from 'utils/reactTools';

import messages from './messages';

const WarningIcon = composeComponent('Profile.Plan.WarningIcon', () => (
  <MIcon drop="4px" title="See browser console for details">
    warning
  </MIcon>
));

const LoadingMargin = styled(Loading)`
  margin-right: 1em;
`;

export default composeComponent('Profile.Plan',
  setPropTypes({
    currentPlan: PropTypes.string,
    email: PropTypes.string,
    handleShowDialog: PropTypes.func,
    handleUpdatePayment: PropTypes.func,
    haveCreditCard: PropTypes.bool,
    isAdmin: PropTypes.bool,
    isLoading: PropTypes.bool,
    isWarning: PropTypes.bool,
    locale: PropTypes.string,
    planMessage: PropTypes.object,
  }),
  ({
    email,
    handleShowDialog,
    handleUpdatePayment,
    haveCreditCard,
    isAdmin,
    isLoading,
    isWarning,
    locale,
    planMessage,
  }) => (
    <Fragment>
      <h1>Service plan</h1>
      <Toolbar>
        <ToolbarGroup>
          {isLoading ? <LoadingMargin /> : null}
          <ToolbarTitle text={planMessage} />
          {isWarning ? <WarningIcon /> : null}
          {haveCreditCard && (!config.team || (config.team && isAdmin))
            ? (
              <StripeCheckout
                allowRememberMe
                amount={0}
                email={email}
                image={icon256}
                locale={locale}
                name="Quilt Data, Inc."
                panelLabel="Update"
                token={handleUpdatePayment}
                stripeKey={config.stripeKey}
                zipCode
              >
                <IconButton
                  disabled={isLoading}
                  tooltip="Update payment card"
                  touch
                >
                  <MIcon drop="0px">credit_card</MIcon>;
                </IconButton>
              </StripeCheckout>
            ) : null
          }
          {(config.team && isAdmin) || !config.team
            ? (
              <RaisedButton
                disabled={isLoading}
                label={<FormattedMessage {...messages.learnMore} />}
                onClick={handleShowDialog}
                style={{ marginLeft: '20px' }}
              />
            ) : null
          }
        </ToolbarGroup>
      </Toolbar>
    </Fragment>
  ));
