/* Catch */
import React from 'react';
import { FormattedMessage } from 'react-intl';
import styled, { keyframes } from 'styled-components';

import Typist from 'react-typist';

import messages from './messages';

function Catch() {
  return (
    <div>
      <h1><FormattedMessage {...messages.header} /></h1>
      <QCode className="fixed qcode">
        <Typist startDelay={2500}>
          <div className="inner">
            quilt install uciml/iris
          </div>
        </Typist>
      </QCode>
    </div>
  );
}

Catch.propTypes = {

};

const makeKeyFrames = () => (
  keyframes`
    0% {
      opacity: 1;
    }
    50% {
      opacity: 0;
    }
    100% {
      opacity: 1;
    }
  `
);

const QCode = styled.div`
  font-size: 2.5em;
  margin: 2em 0 3em 0;
  text-align: center;
  .Typist .inner {
    display: inline-block;
    margin: 0 auto;
  }
  
  .Typist .Cursor--blinking {
    opacity: 1;
    animation: ${makeKeyFrames()} 1s linear infinite;
  }
`;

export default Catch;
