/* Help - inline help for features */
import React from 'react';
import FlatButton from 'material-ui/FlatButton';

import QButton from 'components/QButton';

// TODO dynamically use <Link> if href is relative or <a>  if href is absolute
function Help({ children, href, primary, raised, secondary }) {
  return (
    raised ?
      <QButton
        href={href}
        label={children}
        primary={primary}
        secondary={secondary}
      /> :
        <FlatButton
          href={href}
          label={children}
          primary={primary}
          secondary={secondary}
        />
  );
}

Help.propTypes = {
  children: React.PropTypes.node,
  href: React.PropTypes.string.isRequired,
  primary: React.PropTypes.bool,
  raised: React.PropTypes.bool,
  secondary: React.PropTypes.bool,
};

Help.defaultProps = {
  children: 'Learn more',
  raised: true,
};

export default Help;
