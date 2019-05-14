/* Spinner */
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'styled-components';

const Drop = styled.div`
  display: inline-block;
  padding-top: ${(props) => props.paddingTop};
`;

function Spinner({ className, drop, ...props }) {
  const myClass = `fa fa-cog fa-fw fa-spin ${className || ''}`;
  return (
    <Drop paddingTop={drop} {...props}>
      <i className={myClass}></i>
    </Drop>
  );
}

Spinner.propTypes = {
  className: PropTypes.string,
  drop: PropTypes.string,
};

Spinner.defaultProps = {
  drop: '0px',
};

export default Spinner;
