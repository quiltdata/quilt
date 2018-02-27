/* PackageList */
import PropTypes from 'prop-types';
import React from 'react';
import { List, ListItem } from 'material-ui/List';

import PackageHandle from 'components/PackageHandle';
import Pagination from 'components/Pagination';
import { listStyle } from 'constants/style';

const renderPackage = (showPrefix, defaultOwner) =>
  ({ is_public, name, owner = defaultOwner }) => { // eslint-disable-line camelcase, react/prop-types
    const handle = `${owner}/${name}`;
    const displayHandle = (
      <PackageHandle
        isPublic={is_public} // eslint-disable-line camelcase
        name={name}
        owner={owner}
        showPrefix={showPrefix}
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
  showPrefix,
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
          {items.map(renderPackage(showPrefix, owner))}
        </List>
      )}
    </Pagination>
  );
}

PackageList.defaultProps = {
  emptyMessage: 'Nothing here yet',
  showPrefix: true,
};

PackageList.propTypes = {
  emptyMessage: PropTypes.node,
  emptyHref: PropTypes.string,
  packages: PropTypes.array,
  showPrefix: PropTypes.bool,
  owner: PropTypes.string,
};

export default PackageList;
