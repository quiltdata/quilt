/* Help - inline help for features */
import PropTypes from 'prop-types';
import React from 'react';
import { Link } from 'react-router-dom';
import {
  componentFromProp,
  defaultProps,
  mapProps,
  setPropTypes,
} from 'recompose';
import FlatButton from 'material-ui/FlatButton';

import QButton from 'components/QButton';
import { composeComponent } from 'utils/reactTools';

export default composeComponent('Help',
  setPropTypes({
    children: PropTypes.node,
    href: PropTypes.string,
    to: PropTypes.string,
    primary: PropTypes.bool,
    raised: PropTypes.bool,
    secondary: PropTypes.bool,
  }),
  defaultProps({
    children: 'Learn more',
    raised: true,
  }),
  mapProps(({ raised, to, children, ...props }) => ({
    component: raised ? QButton : FlatButton,
    containerElement: to ? <Link to={to} /> : undefined,
    label: children,
    ...props,
  })),
  componentFromProp('component'));
