/* TakeAction */
import RaisedButton from 'material-ui/RaisedButton';
import React from 'react';
import styled from 'styled-components';

import { makeSignInURL } from 'utils/auth';
import { installQuilt } from 'constants/urls';

const Container = styled.div`

  & > :first-child {
    margin-bottom: 16px;
    margin-right: 16px;
  }

  padding: 4px; /* sometimes button shift down due to mysterious circumstances; e.g. missing an href */

`;

function TakeAction() {
  return (
    <Container>
      <RaisedButton href={makeSignInURL()} label="Sign Up" primary />
      <RaisedButton href={installQuilt} label="Install" />
    </Container>
  );
}

TakeAction.propTypes = {

};

export default TakeAction;
