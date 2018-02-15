/* Core Look and Feel provider for web app */
import PropTypes from 'prop-types';
import React from 'react';
import { Grid } from 'react-bootstrap';
import getMuiTheme from 'material-ui/styles/getMuiTheme';
import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider';

import { palette } from 'constants/style';

//  Custom theme palette
const quilt = getMuiTheme({
  palette,
});

const CoreLF = ({ children }) => (
  <MuiThemeProvider muiTheme={quilt}>
    <Grid fluid>
      {React.Children.toArray(children)}
    </Grid>
  </MuiThemeProvider>
);

CoreLF.propTypes = {
  children: PropTypes.node,
};

export default CoreLF;
