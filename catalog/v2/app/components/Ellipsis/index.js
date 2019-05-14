/* Ellipsis - standard text truncation */
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'styled-components';

export const Truncate = styled.div`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

function Ellipsis({ children, title }) {
  return (
    <Truncate title={title}>
      {children}
    </Truncate>
  );
}

Ellipsis.propTypes = {
  children: PropTypes.node,
  title: PropTypes.string,
};

export default Ellipsis;
