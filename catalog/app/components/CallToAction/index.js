/* CallToAction */
import React from 'react';
import { Row } from 'react-bootstrap';
import FlatButton from 'material-ui/FlatButton';
import styled from 'styled-components';
import { slackInvite } from 'constants/urls';

import FAIcon from 'components/FAIcon';

const Styler = styled(Row)`
  background-color: rgb(240, 240, 240);
  border-bottom: 1px solid rgb(222, 222, 222);
  padding: 16px;
`;

function openIntercom() {
  // eslint-disable-next-line no-undef
  if (Intercom) {
    // eslint-disable-next-line no-undef
    Intercom('show');
  }
}

// terrible hack to avoid extremely funky layout bugs with material-ui
// which returns a different compnent type when href is given
// TODO fix this
const go = (dest) => () => { window.location = dest; };

function CallToAction() {
  return (
    <Styler>
      <FlatButton
        label={<span><FAIcon type="slack">check</FAIcon> Join Slack</span>}
        onClick={go(slackInvite)}
      />
      <FlatButton
        label={<span><FAIcon type="chatBubble">check</FAIcon> Request demo</span>}
        onClick={openIntercom}
      />
    </Styler>
  );
}

CallToAction.propTypes = {

};

export default CallToAction;
