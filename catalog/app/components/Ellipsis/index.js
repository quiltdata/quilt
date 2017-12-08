/* Ellipsis - standard text truncation */
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
  children: React.PropTypes.node,
  title: React.PropTypes.string,
};

export default Ellipsis;
