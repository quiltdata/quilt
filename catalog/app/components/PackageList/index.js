/* PackageList */
import PropTypes from 'prop-types';
import React from 'react';
import { List, ListItem } from 'material-ui/List';

import PackageHandle from 'components/PackageHandle';
import Pagination from 'components/Pagination';
import { listStyle } from 'constants/style';

const renderPackage = (showOwner, defaultOwner) =>
  ({ is_public, name, owner = defaultOwner }) => { // eslint-disable-line camelcase, react/prop-types
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
  };

function PackageList({
  emptyMessage,
  emptyHref,
  packages,
  showOwner,
  owner,
}) {
  if (packages.length === 0) {
    return (
      <List style={listStyle}>
        <ListItem primaryText={emptyMessage} href={emptyHref} />
      </List>
    );
  }

  return (
    <Pagination items={packages}>
      {({ items }) => (
        <List style={listStyle}>
          {items.map(renderPackage(showOwner, owner))}
        </List>
      )}
    </Pagination>
  );
}

PackageList.defaultProps = {
  emptyMessage: 'Nothing here yet',
  showOwner: true,
};

PackageList.propTypes = {
  emptyMessage: PropTypes.node,
  emptyHref: PropTypes.string,
  packages: PropTypes.array,
  showOwner: PropTypes.bool,
  owner: PropTypes.string,
};

export default PackageList;
