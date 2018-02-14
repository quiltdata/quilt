import PT from 'prop-types';
import React from 'react';
import { compose, setPropTypes, setDisplayName } from 'recompose';

export default compose(
  setPropTypes({
    actions: PT.arrayOf(
      PT.oneOfType([
        PT.oneOf(['divider']),
        PT.shape({
          text: PT.string.isRequired,
          callback: PT.string.isRequired,
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
      actions.map((a) =>
        a === 'divider'
        ?
        <Divider style={{ borderBottom: '1px solid' }} />
        :
        <MenuItem primaryText={a.text} onClick={a.callback} />
      )
    }
  </IconMenu>
));
