/* PaymentDialog */
import Dialog from 'material-ui/Dialog';
import { RadioButton, RadioButtonGroup } from 'material-ui/RadioButton';
import RaisedButton from 'material-ui/RaisedButton';
import React, { PropTypes } from 'react';
import StripeCheckout from 'react-stripe-checkout';
import { FormattedMessage } from 'react-intl';
import styled from 'styled-components';

import Confirm from 'components/Confirm';
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
  state = {
    showConfirm: false,
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
    /* if the transition is undefined or same => same there's nothing to do */
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
          onClick={() => this.setState({ showConfirm: true })}
          primary
        />
      );
    } else if (next.rank > curr.rank) {
      const description = next.rank === 2 ?
        'Monthly Business Plan (10 users)' :
        `Monthly ${next.menu} Plan`;

      primaryAction = (
        <StripeCheckout
          allowRememberMe
          amount={next.cost}
          description={description}
          email={email}
          image="https://d1j3mlw4fz6jw9.cloudfront.net/quilt-packages-stripe-checkout-logo.png"
          locale={locale}
          name="Quilt Data, Inc."
          panelLabel="Pay"
          token={onToken}
          stripeKey={config.stripeKey}
          zipCode
        >
          <RaisedButton label="Pay and upgrade" primary />
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
              label="Cancel"
              onClick={onRequestClose}
              style={{ marginLeft: 16 }}
            />
            <br />
            <br />
            <Pricing takeAction={false} />
          </Content>
        </Dialog>
        <Confirm
          onConfirm={() => onDowngrade()}
          onRequestClose={() => this.setState({ showConfirm: false })}
          open={this.state.showConfirm}
        />
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
  const choices = values.map((v) => (
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
