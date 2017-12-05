/* PackageList */
import React, { PropTypes } from 'react';
import { List, ListItem } from 'material-ui/List';

import PackageHandle from 'components/PackageHandle';
import { listStyle } from 'constants/style';

function PackageList({ emptyMessage = 'Nothing here yet', emptyHref, packages, showOwner }) {
  if (packages.length === 0) {
    return (
      <List style={listStyle}>
        <ListItem primaryText={emptyMessage} href={emptyHref} />
      </List>
    );
  }
  const items = packages.map(({ is_public, name, owner }) => { // eslint-disable-line camelcase
    const handle = `${owner}/${name}`;
    const displayHandle = (
      <PackageHandle
        isPublic={is_public} // eslint-disable-line camelcase
        name={name}
        owner={owner}
        showOwner={showOwner}
      />
    );
    return (
      <ListItem
        key={handle}
        primaryText={displayHandle}
        href={`/package/${handle}`}
      />
    );
  });

  return (
    <List style={listStyle}>
      {items}
    </List>
  );
}

PackageList.defaultProps = {
  showOwner: true,
};

PackageList.propTypes = {
  emptyMessage: PropTypes.node,
  emptyHref: PropTypes.string,
  packages: PropTypes.array,
  showOwner: PropTypes.bool,
};

export default PackageList;
