/* Profile */
import invoke from 'lodash/fp/invoke';
import { Tabs, Tab } from 'material-ui/Tabs';
import PropTypes from 'prop-types';
import React, { Fragment } from 'react';
import { FormattedMessage, injectIntl, intlShape } from 'react-intl';
import { connect } from 'react-redux';
import { push } from 'react-router-redux';
import { compose } from 'recompose';
import { createStructuredSelector } from 'reselect';

import Admin from 'containers/Admin/Loadable';
import apiStatus from 'constants/api';
import config from 'constants/config';
import Error from 'components/Error';
import { Skip } from 'components/LayoutHelpers';
import PaymentDialog from 'components/PaymentDialog';
import paymentMessages from 'components/PaymentDialog/messages';
import * as authSelectors from 'containers/Auth/selectors';
import { printObject } from 'utils/string';
import Working from 'components/Working';
import { injectReducer } from 'utils/ReducerInjector';
import { injectSaga } from 'utils/SagaInjector';

import Packages from './Packages';
import Plan from './Plan';
import { getProfile, updatePayment, updatePlan } from './actions';
import { PLANS, REDUX_KEY } from './constants';
import reducer from './reducer';
import { makeSelectProfile } from './selectors';
import saga from './saga';

const defaultSection = 'packages';

const makeSectionUrl = (section) =>
  `/profile${section === defaultSection ? '' : `/${section}`}`;

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
    if (!config.stripeKey) return false;

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
    const { profile, dispatch } = this.props;
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

    const planMessage = plan.response in paymentMessages
      ? <FormattedMessage {...paymentMessages[plan.response]} />
      : <FormattedMessage {...paymentMessages.unrecognized} />;

    const { is_admin: isAdmin } = response;
    const { section = defaultSection } = this.props.match.params;

    return (
      <div>
        {config.team && isAdmin
          ? (
            <Fragment>
              <Skip />
              <Tabs
                value={section}
                onChange={compose(dispatch, push, makeSectionUrl)}
              >
                <Tab label="packages" value="packages" />
                <Tab label="admin" value="admin" />
              </Tabs>
              <Skip />
            </Fragment>
          ) : null
        }
        {invoke(section, {
          packages: () => (
            <Packages
              push={compose(dispatch, push)}
              packages={response.packages}
              shortName={shortName}
              user={this.props.user}
            />
          ),
          admin: () => <Admin plan={plan.response} location={this.props.location} />,
        })}

        {config.stripeKey
          ? (
            <Fragment>
              <Plan
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
            </Fragment>
          ) : null
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
  match: PropTypes.shape({
    params: PropTypes.shape({
      section: PropTypes.string,
    }).isRequired,
  }).isRequired,
  location: PropTypes.object.isRequired,
};

export default compose(
  injectReducer(REDUX_KEY, reducer),
  injectSaga(REDUX_KEY, saga),
  injectIntl,
  connect(createStructuredSelector({
    profile: makeSelectProfile(),
    user: authSelectors.username,
    email: authSelectors.email,
  })),
)(Profile);
