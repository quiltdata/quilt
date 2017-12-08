/* Profile */
import Avatar from 'material-ui/Avatar';
import IconButton from 'material-ui/IconButton';
import RaisedButton from 'material-ui/RaisedButton';
import React, { PropTypes } from 'react';
import { connect } from 'react-redux';
import { FormattedMessage, injectIntl, intlShape } from 'react-intl';
import StripeCheckout from 'react-stripe-checkout';
import { createStructuredSelector } from 'reselect';
import styled from 'styled-components';
import { Toolbar, ToolbarGroup, ToolbarSeparator, ToolbarTitle } from 'material-ui/Toolbar';

import apiStatus from 'constants/api';
import { makeSignInURL } from 'utils/auth';
import config from 'constants/config';
import Error from 'components/Error';
import Help from 'components/Help';
import Loading from 'components/Loading';
import MIcon from 'components/MIcon';
import PackageList from 'components/PackageList';
import PaymentDialog from 'components/PaymentDialog';
import paymentMessages from 'components/PaymentDialog/messages';
import {
  makeSelectAuth,
  makeSelectEmail,
  makeSelectSignedIn,
  makeSelectUserName,
} from 'containers/App/selectors';
import { printObject } from 'utils/string';
import { makePackage } from 'constants/urls';
import Working from 'components/Working';

import { getProfile, updatePayment, updatePlan } from './actions';
import { PLANS } from './constants';
import { makeSelectProfile } from './selectors';
import messages from './messages';

const Content = styled.div`
  h1:not(:first-child) {
    margin-top: 1em;
  }
`;

const LoadingMargin = styled(Loading)`
  margin-right: 1em;
`;

export class Profile extends React.PureComponent { // eslint-disable-line react/prefer-stateless-function
  state = {
    requestedProfile: false,
    showDialog: false,
  };

  componentWillMount() {
    const { auth, authenticated } = this.props;
    // at this point in the flow one of the following must hold:
    // * the store is hydrated with valid auth from local storage => authenticated === true
    // * user is normally authenticated => authenticated === TRUE
    // * store hydrated with an expired token and doRefresh fired REFRESH_AUTH => auth.status === WAITING
    // * OAuth2 component has fired GET_AUTH => auth.status === WAITING
    // * the user is simply not authenticated and there is no auth pending
    // so if user is not authenticated and isn't trying, boot them
    if (!authenticated && auth.status !== apiStatus.WAITING) {
      // we cannot navigate with the react-router/or react-router-redux since
      // they only handle relative paths (not absolute URLs)
      // we also cannot redirect with onEnter for /profile since that
      // fires too early, before we know auth status
      // so we are left with one choice :)
      window.location = makeSignInURL();
    }
    this.maybeGetProfile(authenticated);
  }

  componentWillReceiveProps(next) {
    const { plan: newPlan } = next.profile;
    const { plan: oldPlan } = this.props.profile;
    if (newPlan && newPlan.response && (newPlan.response !== oldPlan.response)) {
      // set initial menu selection for payments to current plan
      this.setState({ selectedPlan: newPlan.response });
    }
    this.maybeGetProfile(next.authenticated);
  }

  onDowngrade = () => {
    const { selectedPlan } = this.state;
    const { dispatch } = this.props;
    dispatch(updatePlan(selectedPlan));
    this.showDialog(false);
  }

  onSelectPlan = (evt, value) => {
    this.setState({ selectedPlan: value });
  }

  onToken = (token) => {
    const { dispatch, currentPlan } = this.props;
    const { selectedPlan } = this.state;
    if (selectedPlan && (currentPlan !== selectedPlan)) {
      dispatch(updatePlan(selectedPlan, token.id));
    }
    this.showDialog(false);
  }

  // TODO this won't work if we switch to a realtime backend
  maybeGetProfile(authenticated) {
    // if and only if we haven't already, get the profile
    if (!this.state.requestedProfile && authenticated) {
      this.setState({ requestedProfile: true });
      this.props.dispatch(getProfile());
    }
  }

  showDialog = (showDialog) => {
    const { currentPlan } = this.props;
    if (!showDialog) {
      // when closing dialog forget selection
      this.setState({ selectedPlan: currentPlan });
    }
    this.setState({ showDialog });
  };

  updatePayment = (token) => {
    const { dispatch } = this.props;
    dispatch(updatePayment(token.id));
  }

  // TODO separate first h1 (user name) from rest of page so that it's not hidden
  // behind the waiting spinner for no reason; better if user sees something right away
  render() {
    const { profile } = this.props;
    const { status, error = {}, payment = {}, plan = {}, response = {} } = profile;
    const { response: err } = error;
    switch (status) {
      case undefined:
      case apiStatus.WAITING:
        return <Working />;
      case apiStatus.ERROR:
        return <Error {...err} />;
      default:
        break;
    }

    const shortName = this.props.user.slice(0, 2).toUpperCase();

    const planWaiting = !plan.status || plan.status === apiStatus.WAITING;
    // payment is undefined in the store by default, don't wait on undefined
    const paymentWaiting = payment.status === apiStatus.WAITING;

    const isLoading = planWaiting || paymentWaiting;
    const isWarning = (
      plan.status === apiStatus.ERROR
      || payment.status === apiStatus.ERROR
      || !plan.response
    );

    const planError = plan.error || {};
    const payError = payment.error || {};
    const warningString = `${printObject(planError)}\n${printObject(payError)}\n${!plan.response ? 'Unrecognized plan' : ''}`;

    const businessMember = plan.response === 'business_member';

    const planMessage = (plan.response in PLANS || businessMember) ?
      <FormattedMessage {...paymentMessages[plan.response]} />
      : plan.response;
    return (
      <div>
        <PaymentDialog
          currentPlan={plan.response}
          email={this.props.email}
          locale={this.props.intl.locale}
          onDowngrade={this.onDowngrade}
          onRequestClose={() => this.showDialog(false)}
          onSelectPlan={this.onSelectPlan}
          open={this.state.showDialog}
          onToken={this.onToken}
          selectedPlan={this.state.selectedPlan}
        />
        <Content>
          <h1><Avatar>{shortName}</Avatar> {this.props.user}</h1>
          <h2><FormattedMessage {...messages.own} /></h2>
          <PackageList
            emptyMessage={<FormattedMessage {...messages.noOwned} />}
            emptyHref={makePackage}
            packages={response.packages.own}
            showOwner={false}
          />
          <h2><FormattedMessage {...messages.shared} /></h2>
          <PackageList packages={response.packages.shared} />
          <h2><FormattedMessage {...messages.public} /></h2>
          <Help href="/search/?q=">
            <FormattedMessage {...messages.showPublic} />
          </Help>
          <h1>Service plan</h1>
          <Toolbar>
            <ToolbarGroup>
              { isLoading ? <LoadingMargin /> : null }
              <ToolbarTitle text={planMessage} />
              { isWarning ? <WarningIcon title={warningString} /> : null }
              {
                this.props.currentPlan !== 'free' && !businessMember && response.have_credit_card ?
                  <StripeCheckout
                    allowRememberMe
                    amount={0}
                    email={this.props.email}
                    image="https://d1j3mlw4fz6jw9.cloudfront.net/quilt-packages-stripe-checkout-logo.png"
                    locale={this.props.intl.locale}
                    name="Quilt Data, Inc."
                    panelLabel="Update"
                    token={this.updatePayment}
                    stripeKey={config.stripeKey}
                    zipCode
                  >
                    <IconButton
                      disabled={isLoading}
                      tooltip="Update payment card"
                      touch
                    >
                      <MIcon>credit_card</MIcon>;
                    </IconButton>
                  </StripeCheckout> : null
              }
              <ToolbarSeparator />
              { !businessMember ?
                <RaisedButton
                  disabled={isLoading}
                  label={<FormattedMessage {...messages.learnMore} />}
                  onClick={() => this.showDialog(true)}
                  primary
                /> : null
              }
            </ToolbarGroup>
          </Toolbar>
        </Content>
      </div>
    );
  }
}

Profile.propTypes = {
  auth: PropTypes.object.isRequired,
  authenticated: PropTypes.bool.isRequired,
  currentPlan: PropTypes.string,
  intl: intlShape.isRequired,
  dispatch: PropTypes.func.isRequired,
  profile: PropTypes.object.isRequired,
  user: PropTypes.string,
  email: PropTypes.string,
};

const mapStateToProps = createStructuredSelector({
  auth: makeSelectAuth(),
  authenticated: makeSelectSignedIn(),
  profile: makeSelectProfile(),
  user: makeSelectUserName(),
  email: makeSelectEmail(),
});

function mapDispatchToProps(dispatch) {
  return {
    dispatch,
  };
}

const WarningIcon = ({ title }) => (
  <MIcon drop="4px" title={title}>
    warning
  </MIcon>
);

WarningIcon.propTypes = {
  title: PropTypes.string.isRequired,
};

export default connect(mapStateToProps, mapDispatchToProps)(injectIntl(Profile));
