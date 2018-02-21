/* Profile */
import Avatar from 'material-ui/Avatar';
import IconButton from 'material-ui/IconButton';
import RaisedButton from 'material-ui/RaisedButton';
import { Tabs, Tab } from 'material-ui/Tabs';
import PropTypes from 'prop-types';
import React from 'react';
import { connect } from 'react-redux';
import { FormattedMessage, injectIntl, intlShape } from 'react-intl';
import StripeCheckout from 'react-stripe-checkout';
import { createStructuredSelector } from 'reselect';
import styled from 'styled-components';
import { Toolbar, ToolbarGroup, ToolbarSeparator, ToolbarTitle } from 'material-ui/Toolbar';

import Admin from 'containers/Admin';
import apiStatus from 'constants/api';
import config from 'constants/config';
import Error from 'components/Error';
import Help from 'components/Help';
import { Skip } from 'components/LayoutHelpers';
import Loading from 'components/Loading';
import MIcon from 'components/MIcon';
import PackageList from 'components/PackageList';
import PaymentDialog from 'components/PaymentDialog';
import paymentMessages from 'components/PaymentDialog/messages';
import {
  makeSelectEmail,
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
    this.maybeGetProfile();
  }

  componentWillReceiveProps(next) {
    const { plan: newPlan } = next.profile;
    const { plan: oldPlan } = this.props.profile;
    if (newPlan && newPlan.response && (newPlan.response !== oldPlan.response)) {
      // set initial menu selection for payments to current plan
      this.setState({ selectedPlan: newPlan.response });
    }
    this.maybeGetProfile();
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
  maybeGetProfile() {
    // if and only if we haven't already, get the profile
    if (!this.state.requestedProfile) {
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
    // eslint-disable-next-line object-curly-newline
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

    const pageOne = (
      <Content>
        <PackagesArea
          packages={response.packages}
          shortName={shortName}
          user={this.props.user}
        />
        <PlanArea
          businessMember={businessMember}
          currentPlan={this.props.currentPlan}
          email={this.props.email}
          handleShowDialog={() => this.showDialog(true)}
          handleUpdatePayment={this.updatePayment}
          haveCreditCard={response.have_credit_card}
          isLoading={isLoading}
          isWarning={isWarning}
          locale={this.props.intl.locale}
          planMessage={planMessage}
          warningString={warningString}
        />
      </Content>
    );

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
        { config.team ?
          <div>
            <Skip />
            <Tabs>
              <Tab label="packages" value="packages">{ pageOne }</Tab>
              <Tab label="admin" value="admin"><Admin /></Tab>
            </Tabs>
            <Skip />
          </div> : pageOne
        }
      </div>
    );
  }
}

Profile.propTypes = {
  currentPlan: PropTypes.string,
  intl: intlShape.isRequired,
  dispatch: PropTypes.func.isRequired,
  profile: PropTypes.object.isRequired,
  user: PropTypes.string,
  email: PropTypes.string,
};

const mapStateToProps = createStructuredSelector({
  profile: makeSelectProfile(),
  user: makeSelectUserName(),
  email: makeSelectEmail(),
});

function mapDispatchToProps(dispatch) {
  return {
    dispatch,
  };
}

const PackagesArea = ({ packages, shortName, user }) => (
  <div>
    <h1><Avatar>{shortName}</Avatar> {user}</h1>
    <h2><FormattedMessage {...messages.own} /></h2>
    <PackageList
      emptyMessage={<FormattedMessage {...messages.noOwned} />}
      emptyHref={makePackage}
      packages={packages.own}
      showOwner={false}
    />
    <h2><FormattedMessage {...messages.shared} /></h2>
    <PackageList packages={packages.shared} />
    <h2><FormattedMessage {...messages[config.team ? 'team' : 'public']} /></h2>
    <Help href="/search/?q=">
      <FormattedMessage {...messages.showPublic} />
    </Help>
  </div>
);

PackagesArea.propTypes = {
  packages: PropTypes.object,
  shortName: PropTypes.string,
  user: PropTypes.string,
};

const PlanArea = ({
  businessMember,
  currentPlan,
  email,
  handleShowDialog,
  handleUpdatePayment,
  haveCreditCard,
  isLoading,
  isWarning,
  locale,
  planMessage,
  warningString,
}) => (
  <div>
    <h1>Service plan</h1>
    <Toolbar>
      <ToolbarGroup>
        { isLoading ? <LoadingMargin /> : null }
        <ToolbarTitle text={planMessage} />
        { isWarning ? <WarningIcon title={warningString} /> : null }
        {
          currentPlan !== 'free' && !businessMember && haveCreditCard ?
            <StripeCheckout
              allowRememberMe
              amount={0}
              email={email}
              image="https://d1j3mlw4fz6jw9.cloudfront.net/quilt-packages-stripe-checkout-logo.png"
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
                <MIcon>credit_card</MIcon>;
              </IconButton>
            </StripeCheckout> : null
        }
        <ToolbarSeparator />
        { !businessMember ?
          <RaisedButton
            disabled={isLoading}
            label={<FormattedMessage {...messages.learnMore} />}
            onClick={handleShowDialog}
            primary
          /> : null
        }
      </ToolbarGroup>
    </Toolbar>
  </div>
);

PlanArea.propTypes = {
  businessMember: PropTypes.bool,
  currentPlan: PropTypes.string,
  email: PropTypes.string,
  handleShowDialog: PropTypes.func,
  handleUpdatePayment: PropTypes.func,
  haveCreditCard: PropTypes.bool,
  isLoading: PropTypes.bool,
  isWarning: PropTypes.bool,
  locale: PropTypes.string,
  planMessage: PropTypes.object,
  warningString: PropTypes.string,
};

const WarningIcon = ({ title }) => (
  <MIcon drop="4px" title={title}>
    warning
  </MIcon>
);

WarningIcon.propTypes = {
  title: PropTypes.string.isRequired,
};

export default connect(mapStateToProps, mapDispatchToProps)(injectIntl(Profile));
