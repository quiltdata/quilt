/* MIcon - wrap material icon for convenience, style control */
import cx from 'classnames';
import omit from 'lodash/fp/omit';
import FontIcon from 'material-ui/FontIcon';
import PropTypes from 'prop-types';
import React from 'react';
import { mapProps } from 'recompose';
import styled, { keyframes, css } from 'styled-components';

import { detailColorHex } from 'constants/style';

/* Drop the baseline so icons look good alongside text */
const Adjust = styled.span`
  position: relative;
  top: ${(props) => props.drop || 0}
`;

const spin = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

const animation = css`
  animation: ${spin} 1s linear infinite;
`;

const Icon = styled(mapProps(omit(['spin']))(FontIcon))`
  ${(p) => p.spin ? animation : ''}
`;

// eslint-disable-next-line object-curly-newline
function MIcon({ className, drop, title, ...rest }) {
  return (
    <Adjust drop={drop} title={title}>
      <Icon
        className={cx('material-icons', className)}
        {...rest}
      />
    </Adjust>
  );
}

MIcon.propTypes = {
  children: PropTypes.string.isRequired,
  className: PropTypes.string,
  color: PropTypes.string,
  drop: PropTypes.string,
  title: PropTypes.string,
  spin: PropTypes.bool,
  style: PropTypes.object,
};

MIcon.defaultProps = {
  color: detailColorHex,
};

export default MIcon;
