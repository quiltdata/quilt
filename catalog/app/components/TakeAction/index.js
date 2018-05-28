/* TakeAction */
import RaisedButton from 'material-ui/RaisedButton';
import PT from 'prop-types';
import React from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

import { installQuilt } from 'constants/urls';

const Container = styled.div`

  & > :first-child {
    margin-bottom: 16px;
    margin-right: 16px;
  }

  padding: 4px; /* sometimes button shift down due to mysterious circumstances; e.g. missing an href */

`;

function TakeAction({ signUp }) {
  return (
    <Container>
      {signUp && (
        <RaisedButton
          containerElement={<Link to="/signup" />}
          label="Sign Up"
          primary
        />
      )}
      <RaisedButton href={installQuilt} label="Install" />
    </Container>
  );
}

TakeAction.propTypes = {
  signUp: PT.bool,
};

TakeAction.defaultProps = {
  signUp: true,
};

export default TakeAction;
