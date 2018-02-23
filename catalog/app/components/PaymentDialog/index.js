/* PaymentDialog */
import Dialog from 'material-ui/Dialog';
import { RadioButton, RadioButtonGroup } from 'material-ui/RadioButton';
import RaisedButton from 'material-ui/RaisedButton';
import PropTypes from 'prop-types';
import React from 'react';
import StripeCheckout from 'react-stripe-checkout';
import { FormattedMessage } from 'react-intl';
import styled from 'styled-components';

import { PLANS } from 'containers/Profile/constants';
import config from 'constants/config';
import Pricing, { width } from 'components/Pricing';

import messages from './messages';

const Content = styled.div`
  h1 {
    margin-top: 0;
  }
`;
const style = {
  // warning this will look off-center if material UI changes it's padding
  // to some number other than 24
  maxWidth: `${width + 48}px`,
  width: '90%',
};

class PaymentDialog extends React.PureComponent { // eslint-disable-line react/prefer-stateless-function
  handleConfirm(curr, next, onDowngrade) {
    if (next.confirmTitle) {
      // eslint-disable-next-line no-alert no-restricted-globals
      const proceed = Window.confirm(`${next.confirmTitle}\n${next.confirmBody}`);
      if (proceed) {
        onDowngrade();
      }
    }
  }

  render() {
    const {
      currentPlan,
      email,
      locale,
      onDowngrade,
      onSelectPlan,
      onRequestClose,
      onToken,
      open,
      selectedPlan,
    } = this.props;

    const curr = PLANS[currentPlan];
    const next = PLANS[selectedPlan];

    let primaryAction;
    /* if the transition is undefined or idempotent, do nothing  */
    if (!curr || !next || curr === next) {
      primaryAction = (
        <RaisedButton
          disabled
          label={<FormattedMessage {...messages.already} />}
          primary
        />
      );
    } else if (next.rank < curr.rank) {
      primaryAction = (
        <RaisedButton
          label="Downgrade"
          onClick={() => this.handleConfirm(curr, next, onDowngrade)}
          primary
        />
      );
    } else if (next.rank > curr.rank) {
      primaryAction = (
        <StripeCheckout
          allowRememberMe
          amount={next.cost}
          description={`Monthly ${next.menu} Plan`}
          email={email}
          image="https://d1zvn9rasera71.cloudfront.net/q-256-square.png"
          locale={locale}
          name="Quilt Data, Inc."
          panelLabel="Pay"
          token={onToken}
          stripeKey={config.stripeKey}
          zipCode
        >
          <RaisedButton label="Upgrade" primary />
        </StripeCheckout>
      );
    }

    return (
      <div>
        <Dialog
          autoScrollBodyContent
          contentStyle={style}
          modal={false}
          onRequestClose={onRequestClose}
          open={open}
        >
          <Content>
            <h1>Select a plan</h1>
            <PlanSelect
              onSelectPlan={onSelectPlan}
              selectedPlan={selectedPlan || currentPlan}
            />
            { primaryAction }
            <RaisedButton
              label="Close"
              onClick={onRequestClose}
              style={{ marginLeft: 16 }}
            />
            <Pricing takeAction={false} title="" />
          </Content>
        </Dialog>
      </div>
    );
  }
}

PaymentDialog.propTypes = {
  currentPlan: PropTypes.string,
  email: PropTypes.string,
  locale: PropTypes.string.isRequired,
  onDowngrade: PropTypes.func.isRequired,
  onSelectPlan: PropTypes.func.isRequired,
  onRequestClose: PropTypes.func.isRequired,
  onToken: PropTypes.func.isRequired,
  open: PropTypes.bool.isRequired,
  selectedPlan: PropTypes.string,
};

const PlanSelect = ({ onSelectPlan, selectedPlan }) => {
  const values = Object.keys(PLANS);
  const choices = values.filter((v) => !v.disallow).map((v) => (
    <RadioButton
      key={v}
      style={{ marginBottom: 16 }}
      value={v}
      label={PLANS[v].menu}
    />
  ));

  return (
    <RadioButtonGroup
      name="Select plan"
      onChange={onSelectPlan}
      valueSelected={selectedPlan}
    >
      { choices }
    </RadioButtonGroup>
  );
};

PlanSelect.propTypes = {
  onSelectPlan: PropTypes.func.isRequired,
  selectedPlan: PropTypes.string,
};

export default PaymentDialog;
