/* MIcon - wrap material icon for convenience, style control */
import cx from 'classnames';
import omit from 'lodash/fp/omit';
import FontIcon from 'material-ui/FontIcon';
import PropTypes from 'prop-types';
import { defaultProps, mapProps, setPropTypes } from 'recompose';
import styled, { keyframes, css } from 'styled-components';

import { detailColorHex } from 'constants/style';
import { composeComponent } from 'utils/reactTools';

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

/* Drop the baseline so icons look good alongside text */
const Icon = styled(mapProps(omit(['spin', 'drop']))(FontIcon))`
  top: ${(p) => p.drop || 0};
  ${(p) => p.spin ? animation : ''}
`;

export default composeComponent('MIcon',
  setPropTypes({
    children: PropTypes.string.isRequired,
    className: PropTypes.string,
    color: PropTypes.string,
    drop: PropTypes.string,
    spin: PropTypes.bool,
  }),
  defaultProps({
    color: detailColorHex,
    spin: false,
  }),
  mapProps(({ className, ...rest }) => ({
    className: cx('material-icons', className),
    ...rest,
  })),
  Icon);
