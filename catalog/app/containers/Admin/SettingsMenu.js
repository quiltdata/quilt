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
    actions: PT.arrayOf( // eslint-disable-line function-paren-newline
      PT.oneOfType([
        PT.oneOf(['divider']),
        PT.shape({
          text: PT.string.isRequired,
          callback: PT.func.isRequired,
        }),
      ]).isRequired
    ).isRequired, // eslint-disable-line function-paren-newline
    arg: PT.any.isRequired,
    busy: PT.bool,
  }),
  setDisplayName('Admin.SettingsMenu'),
)(({ actions, arg, busy = false }) => (
  <IconMenu
    iconButtonElement={<IconButton><MIcon spin={busy}>settings</MIcon></IconButton>}
    anchorOrigin={{ horizontal: 'left', vertical: 'top' }}
    targetOrigin={{ horizontal: 'right', vertical: 'top' }}
  >
    {actions.map((a, i) =>
      a === 'divider'
        // eslint-disable-next-line react/no-array-index-key
        ? <Divider key={`${i} divider`} style={{ borderBottom: '1px solid' }} />
        // eslint-disable-next-line react/no-array-index-key
        : <MenuItem key={`${i} ${a.text}`} primaryText={a.text} onClick={() => a.callback(arg)} />
      // eslint-disable-next-line function-paren-newline
    )}
  </IconMenu>
));
