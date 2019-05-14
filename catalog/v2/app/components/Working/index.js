/* Authentication progress */
import PropTypes from 'prop-types';
import React from 'react';
import { FormattedMessage } from 'react-intl';
import styled from 'styled-components';

import Spinner from 'components/Spinner';

import messages from './messages';

const Faint = styled.div`
  opacity: 0.6;
`;

function Working({ children }) {
  return (
    <Faint>
      <h1>
        <Spinner />
        { children }
      </h1>
    </Faint>
  );
}

Working.propTypes = {
  children: PropTypes.node,
};

Working.defaultProps = {
  children: <FormattedMessage {...messages.header} />,
};

export default Working;
