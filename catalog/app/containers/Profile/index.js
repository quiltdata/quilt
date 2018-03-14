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
import { compose } from 'recompose';
import { createStructuredSelector } from 'reselect';
import styled from 'styled-components';
import { Toolbar, ToolbarGroup, ToolbarTitle } from 'material-ui/Toolbar';

import Admin from 'containers/Admin/Loadable';
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
import { icon256, makePackage } from 'constants/urls';
import Working from 'components/Working';
import { injectReducer } from 'utils/ReducerInjector';
import { injectSaga } from 'utils/SagaInjector';

import { getProfile, updatePayment, updatePlan } from './actions';
import { PLANS, REDUX_KEY } from './constants';
import reducer from './reducer';
import { makeSelectProfile } from './selectors';
import messages from './messages';
import saga from './saga';

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
    const { dispatch, profile: { plan = {} } } = this.props;
    const currentPlan = plan.response;
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

  maybeWarn(plan, payment) {
    let error = false;
    if (plan.error) {
      console.error(printObject(plan.error)); // eslint-disable-line no-console
      error = true;
    }
    if (payment.error) {
      console.error(printObject(payment.error)); // eslint-disable-line no-console
      error = true;
    }
    if (!(plan.response in PLANS)) {
      console.error(`Unrecognized plan: ${plan.response}`); // eslint-disable-line no-console
      error = true;
    }
    return error;
  }

  showDialog = (showDialog) => {
    const { profile: { plan = {} } } = this.props;
    if (!showDialog) {
      // when closing dialog forget selection
      this.setState({ selectedPlan: plan.response });
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
    const { profile, router } = this.props;
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

    const shortName = this.props.user.slice(0, 2);
    const planWaiting = !plan.status || plan.status === apiStatus.WAITING;
    // payment is undefined in the store by default, so don't wait on undefined
    const paymentWaiting = payment.status === apiStatus.WAITING;

    const isLoading = planWaiting || paymentWaiting;
    const isWarning = this.maybeWarn(plan, payment);

    const planMessage = plan.response in paymentMessages ?
      <FormattedMessage {...paymentMessages[plan.response]} />
      : <FormattedMessage {...paymentMessages.unrecognized} />;

    const pageOne = (
      <PackagesArea
        push={router.push}
        packages={response.packages}
        shortName={shortName}
        user={this.props.user}
      />
    );

    const { is_admin: isAdmin } = response;
    return (
      <div>
        { config.team && isAdmin ?
          <div>
            <Skip />
            <Tabs>
              <Tab label="packages" value="packages">{ pageOne }</Tab>
              <Tab label="admin" value="admin"><Admin plan={plan.response} /></Tab>
            </Tabs>
            <Skip />
          </div> : pageOne
        }
        <PlanArea
          currentPlan={plan.response}
          email={this.props.email}
          handleShowDialog={() => this.showDialog(true)}
          handleUpdatePayment={this.updatePayment}
          haveCreditCard={response.have_credit_card}
          isAdmin={isAdmin}
          isLoading={isLoading}
          isWarning={isWarning}
          locale={this.props.intl.locale}
          planMessage={planMessage}
        />
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
      </div>
    );
  }
}

Profile.propTypes = {
  currentPlan: PropTypes.string,
  intl: intlShape.isRequired,
  dispatch: PropTypes.func.isRequired,
  profile: PropTypes.object.isRequired,
  router: PropTypes.object.isRequired,
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

const PackagesArea = ({
  packages,
  push,
  shortName,
  user,
}) => (
  <div>
    <h1><Avatar>{shortName}</Avatar> {user}</h1>
    <h2><FormattedMessage {...messages.own} /></h2>
    <PackageList
      push={push}
      emptyMessage={<FormattedMessage {...messages.noOwned} />}
      emptyHref={makePackage}
      packages={packages.own}
      showPrefix={false}
    />
    <h2><FormattedMessage {...messages.shared} /></h2>
    <PackageList push={push} packages={packages.shared} />
    <h2><FormattedMessage {...messages[config.team ? 'team' : 'public']} /></h2>
    <Help to="/search/?q=">
      <FormattedMessage {...messages.showPublic} />
    </Help>
  </div>
);

PackagesArea.propTypes = {
  packages: PropTypes.object,
  push: PropTypes.func.isRequired,
  shortName: PropTypes.string,
  user: PropTypes.string,
};

const PlanArea = ({
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
  <div>
    <h1>Service plan</h1>
    <Toolbar>
      <ToolbarGroup>
        { isLoading ? <LoadingMargin /> : null }
        <ToolbarTitle text={planMessage} />
        { isWarning ? <WarningIcon /> : null }
        {
          haveCreditCard && (!config.team || (config.team && isAdmin)) ?
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
            </StripeCheckout> : null
        }
        {
          (config.team && isAdmin) || !config.team ? (
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
  </div>
);

PlanArea.propTypes = {
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
};

const WarningIcon = () => (
  <MIcon drop="4px" title="See browser console for details">
    warning
  </MIcon>
);

export default compose(
  injectReducer(REDUX_KEY, reducer),
  injectSaga(REDUX_KEY, saga),
  injectIntl,
  connect(mapStateToProps, mapDispatchToProps),
)(Profile);
