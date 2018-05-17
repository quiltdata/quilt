/* PackageList */
import PropTypes from 'prop-types';
import React from 'react';
import { List, ListItem } from 'material-ui/List';

import PackageHandle from 'components/PackageHandle';
import Pagination from 'components/Pagination';
import { listStyle } from 'constants/style';
import { ellipsisObj } from '../LayoutHelpers';

const renderPackage = (showPrefix, defaultOwner, push) => (item) => { // eslint-disable-line camelcase, react/prop-types
  const {
    is_public: isPublic,
    is_team: isTeam,
    name,
    owner = defaultOwner,
    readme_preview: readmePreview,
  } = item;
  const handle = `${owner}/${name}`;
  const display = (
    <span>
      <PackageHandle
        drop
        isPublic={isPublic}
        isTeam={isTeam}
        name={name}
        owner={owner}
        showPrefix={showPrefix}
        readmePreview={readmePreview}
      />
    </span>
  );
  return (
    // lineHeight necessary to prevent clipping of descenders in child components
    <ListItem
      key={handle}
      onClick={() => push(`/package/${handle}`)}
      primaryText={display}
      style={Object.assign({ lineHeight: '1.2em'}, ellipsisObj)}
      title={readmePreview}
    />
  );
};

function PackageList({
  emptyMessage,
  emptyHref,
  packages,
  push,
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
          {items.map(renderPackage(showPrefix, owner, push))}
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
  push: PropTypes.func.isRequired,
  showPrefix: PropTypes.bool,
  owner: PropTypes.string,
};

export default PackageList;
