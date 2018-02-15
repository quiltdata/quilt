import Divider from 'material-ui/Divider';
import IconButton from 'material-ui/IconButton';
import IconMenu from 'material-ui/IconMenu';
import MenuItem from 'material-ui/MenuItem';
import PT from 'prop-types';
import React from 'react';
import { compose, setPropTypes, setDisplayName } from 'recompose';

import MIcon from 'components/MIcon';

export default compose(
  setPropTypes({
    actions: PT.arrayOf(
      PT.oneOfType([
        PT.oneOf(['divider']),
        PT.shape({
          text: PT.string.isRequired,
          callback: PT.func.isRequired,
        }),
      ]).isRequired
    ).isRequired,
  }),
  setDisplayName('Admin.SettingsMenu'),
)(({ actions }) => (
  <IconMenu
    iconButtonElement={<IconButton><MIcon>settings</MIcon></IconButton>}
    anchorOrigin={{ horizontal: 'left', vertical: 'top' }}
    targetOrigin={{ horizontal: 'right', vertical: 'top' }}
  >
    {
      actions.map((a, i) =>
        a === 'divider'
          ? <Divider key={i} style={{ borderBottom: '1px solid' }} />
          : <MenuItem key={i} primaryText={a.text} onClick={a.callback} />
      )
    }
  </IconMenu>
));
