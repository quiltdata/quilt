/* constants for use in CSS. prefer integers over strings so we can do math */
import { grey300, grey200, grey800 } from 'material-ui/styles/colors';

export const appBackgroundColor = '#fafafa';
export const authButtonStyle = {
  color: grey200,
};
const back = [16, 16, 16];
export const backgroundColor = `rgb(${back[0]}, ${back[1]}, ${back[2]})`;
export const backgroundColorAlpha = (alpha) =>
  `rgba(${back[0]}, ${back[1]}, ${back[2]}, ${alpha})`;
export const bodyColor = 'rgb(32, 32, 32)';
export const bodySize = '1em';
//  inspiration: https://v4-alpha.getbootstrap.com/layout/overview/#responsive-breakpoints
//  these are the bottoms of the breakpoints (min-width)
export const breaks = {
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
};
Object.freeze(breaks);
export const detailColorHex = '#666';
export const fontWeightNormalStyle = {
  fontWeight: 'normal',
};
export const headerColor = 'rgb(32, 32, 32)';
export const h2HomeSize = '2em';
export const listStyle = {
  backgroundColor: 'white',
  border: '1px solid #ddd',
};
export const palette = {
  primary1Color: backgroundColor,
  primary2Color: 'rgb(2, 58, 71)',
  accent1Color: '#F88500',
  accent2Color: grey200,
  accent3Color: grey300,
  textColor: grey800, // see also global-styles.js
};

export const plainTextStyle = {
  textTransform: 'none',
};

export const radius = '16px';

export const rowVSpace = '1em';

export const smallest = {
  height: '480px',
  width: '320px',
};
