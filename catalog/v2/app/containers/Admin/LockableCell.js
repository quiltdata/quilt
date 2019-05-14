import omit from 'lodash/fp/omit';
import { TableRowColumn } from 'material-ui/Table';
import { mapProps } from 'recompose';
import styled, { css } from 'styled-components';

const locked = css`
  &::after {
    background: rgba(255, 255, 255, .5);
    bottom: 0;
    content: "";
    left: 0;
    position: absolute;
    right: 0;
    top: 0;
  }
`;

export default styled(mapProps(omit(['locked']))(TableRowColumn))`
  position: relative;
  ${(p) => p.locked ? locked : ''}
`;
