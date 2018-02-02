/* Simple Layout Helpers */
import PropTypes from 'prop-types';
import styled from 'styled-components';

import { breaks, rowVSpace } from 'constants/style';

export const BigSkip = styled.div`
  margin-bottom: 8em;
`;

export function breakUnder(size, css) {
  const max = breaks[size] - 1;
  return (
    `@media (max-width:${max}px) {
      ${css}
    }`
  );
}

export const CenterText = styled.div`
  text-align: center;
`;

/* Pad - simple padding box */
const pad = '2em';
const smPad = '.8em';
export const Pad = styled.div`
  padding-bottom: ${(props) => props.bottom ? pad : 0};
  padding-left: ${(props) => props.left ? pad : 0};
  padding-right: ${(props) => props.right ? pad : 0};
  /* account for h1 margin-top */
  padding-top: ${(props) => props.top ? smPad : 0};
`;

// for unboxing content; get for full-bleed pages
export const UnPad = styled.div`
  margin-bottom: -${pad};
  margin-left: -${pad};
  margin-right: -${pad};
  margin-top: -${smPad};
`;

export const HCenter = styled.div`
  & > div, & > iframe {
    display: block;
    margin: 0 auto;
  }
`;

/* SpaceRows - Add vertical space between stacked rows */
export const SpaceRows = styled.div`
  > .row {
    margin-bottom: ${rowVSpace};
  }
`;

/* Scroll - Simple way to prevent layout overflow */
export const Scroll = styled.div`
  overflow: auto;
`;

/* Stack - Inject margin between stacking columns */
export const Stack = styled.div`
  @media (max-width:${(props) => props.maxWidth}) {
    > div:not(:first-child) {
      margin-top: ${(props) => props.margin};
    }
  }
`;

Stack.propTypes = {
  breakPoint: PropTypes.string,
  margin: PropTypes.string,
};

const sm = `${breaks.md - 1}px`; //  upper end of sm breakpoint
Stack.defaultProps = {
  margin: '3em',
  maxWidth: sm,
};
