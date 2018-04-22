import orderBy from 'lodash/orderBy';
import omit from 'lodash/fp/omit';
import { List, ListItem } from 'material-ui/List';
import {
  Table,
  TableBody,
  TableHeader,
  TableHeaderColumn,
  TableRow,
  TableRowColumn,
} from 'material-ui/Table';
import { grey400, grey800 } from 'material-ui/styles/colors';
import PT from 'prop-types';
import React from 'react';
import { FormattedDate as FD, FormattedMessage as FM } from 'react-intl';
import { Link } from 'react-router-dom';
import {
  compose,
  mapProps,
  setPropTypes,
  withHandlers,
  withPropsOnChange,
  withStateHandlers,
} from 'recompose';
import styled from 'styled-components';

import MIcon from 'components/MIcon';
import PackageHandle from 'components/PackageHandle';
import {
  composeComponent,
  composeHOC,
  restoreProps,
  saveProps,
} from 'utils/reactTools';
import { readableBytes, readableQuantity } from 'utils/string';
import { headerColor, listStyle } from 'constants/style';

import msg from './messages';


const withSorting = (prop, fields, opts = {}) =>
  composeHOC(`withSorting(${prop})`,
    saveProps({ keep: [prop] }),
    withStateHandlers({
      field: opts.field || null,
      direction: opts.direction || null,
    }, {
      sortBy: ({ field, direction }) => (subj) => {
        if (field !== subj) return { field: subj, direction: 'asc' };
        if (direction === 'asc') return { direction: 'desc' };
        return { field: null, direction: null };
      },
    }),
    withPropsOnChange([prop, 'field', 'direction'], ({ [prop]: items, field, direction }) => ({
      [prop]: orderBy(items, [fields[field]], [direction]),
    })),
    withHandlers({
      sortOrder: ({ field, direction }) => (subj) =>
        field === subj ? direction : null,
    }),
    restoreProps({ keep: [prop, 'sortBy', 'sortOrder'] }));


const omitProps = compose(mapProps, omit);

const valueWidth = '80px';

const TableContainer = styled.div`
  border: 1px solid #ddd;

  table, td, th {
    border: none;
  }
`;

const CellContainer = styled.span`
  display: flex;
  flex-wrap: wrap;

  *:not(:first-child) > & {
    justify-content: flex-end;
  };
`;

const HeaderCell = composeComponent('PackageTable.HeaderCell',
  setPropTypes({
    children: PT.node,
  }),
  ({ children }) => (
    <TableHeaderColumn>
      <CellContainer>{children}</CellContainer>
    </TableHeaderColumn>
  ));

const BodyCell = composeComponent('PackageTable.BodyCell',
  setPropTypes({
    children: PT.node,
  }),
  ({ children }) => (
    <TableRowColumn>
      <CellContainer>{children}</CellContainer>
    </TableRowColumn>
  ));

const Label = styled(omitProps(['active', 'current'])('span'))`
  color: ${(p) => p.current ? grey800 : grey400} !important;
  cursor: ${(p) => p.active ? 'pointer' : 'default'};
  display: inline-flex;
  padding-bottom: .25em;
  padding-top: .25em;

  &:hover {
    color: ${(p) => p.active ? grey800 : grey400} !important;
  }
`;

const ValueLabel = styled(Label)`
  justify-content: flex-end;
  width: ${valueWidth};
`;

const SuperLabel = styled(Label)`
  flex-basis: 100%;
  justify-content: center;
  padding-left: 7em;
`;

const OrderIcon = styled(omitProps(['current'])(MIcon))`
  color: ${(p) => p.current ? grey800 : 'transparent'} !important;
  margin-right: .3rem;
  font-size: ${4 / 3}em !important;
  transition: color 0s !important;

  ${Label}:hover & {
    color: ${(p) => p.current ? 'inherit' : grey400} !important;
  }
`;

const orderIcons = {
  asc: 'arrow_upward',
  desc: 'arrow_downward',
};

const SortLabel = composeComponent('PackageTable',
  setPropTypes({
    order: PT.oneOf(Object.keys(orderIcons)),
    sort: PT.func.isRequired,
    children: PT.node,
  }),
  ({ order, sort, children }) => (
    <ValueLabel active current={!!order} onClick={sort}>
      <OrderIcon current={!!order}>{orderIcons[order || 'asc']}</OrderIcon>
      {children}
    </ValueLabel>
  ));

const Value = styled.span`
  text-align: right;
  width: ${valueWidth};
`;

const StyledLink = styled(Link)`
  &, &:active, &:visited, &:focus, &:hover {
    color: ${headerColor};
    text-decoration: none;
  }
`;


// TODO: wire up the backend when it's ready
const stubValues = (pkg) => ({
  ...pkg,
  size: Math.ceil(100000 * Math.random()),
  views: Math.ceil(100000 * Math.random()),
  viewsRecent: Math.ceil(100000 * Math.random()),
  installs: Math.ceil(100000 * Math.random()),
  installsRecent: Math.ceil(100000 * Math.random()),
  updatedOn: new Date(Date.now() - (1000 * 60 * 60 * 24 * 30 * Math.random())),
});

export default composeComponent('PackageTable',
  setPropTypes({
    emptyMessage: PT.node,
    emptyHref: PT.string,
    packages: PT.array,
    showPrefix: PT.bool,
  }),
  // TODO: remove when backend is ready
  withPropsOnChange(['packages'], ({ packages }) => ({
    packages: packages ? packages.map(stubValues) : packages,
  })),
  withSorting('packages', {
    size: 'size',
    installs: 'installs',
    installsRecent: 'installsRecent',
    views: 'views',
    viewsRecent: 'viewsRecent',
    updatedOn: 'updatedOn',
  }),
  ({
    emptyMessage = 'Nothing here yet',
    emptyHref,
    packages,
    showPrefix = true,
    sortBy,
    sortOrder,
  }) =>
    packages.length === 0
      ? (
        <List style={listStyle}>
          <ListItem primaryText={emptyMessage} href={emptyHref} />
        </List>
      )
      : (
        <TableContainer>
          <Table selectable={false}>
            <TableHeader
              displaySelectAll={false}
              adjustForCheckbox={false}
              enableSelectAll={false}
            >
              <TableRow>
                <HeaderCell><Label><FM {...msg.name} /></Label></HeaderCell>
                <HeaderCell>
                  <SortLabel order={sortOrder('size')} sort={() => sortBy('size')}>
                    <FM {...msg.size} />
                  </SortLabel>
                </HeaderCell>
                <HeaderCell>
                  <SuperLabel><FM {...msg.installs} /></SuperLabel>
                  <SortLabel order={sortOrder('installsRecent')} sort={() => sortBy('installsRecent')}>
                    <FM {...msg.lastWeek} />
                  </SortLabel>
                  <SortLabel order={sortOrder('installs')} sort={() => sortBy('installs')}>
                    <FM {...msg.total} />
                  </SortLabel>
                </HeaderCell>
                <HeaderCell>
                  <SuperLabel>Views</SuperLabel>
                  <SortLabel order={sortOrder('viewsRecent')} sort={() => sortBy('viewsRecent')}>
                    <FM {...msg.lastWeek} />
                  </SortLabel>
                  <SortLabel order={sortOrder('views')} sort={() => sortBy('views')}>
                    <FM {...msg.total} />
                  </SortLabel>
                </HeaderCell>
                <HeaderCell>
                  <SortLabel order={sortOrder('updatedOn')} sort={() => sortBy('updatedOn')}>
                    <FM {...msg.updatedOn} />
                  </SortLabel>
                </HeaderCell>
              </TableRow>
            </TableHeader>

            <TableBody displayRowCheckbox={false} showRowHover>
              {packages.map((pkg) => (
                <TableRow selectable={false} key={pkg.name}>
                  <BodyCell>
                    <StyledLink to={`/package/${pkg.owner}/${pkg.name}`}>
                      <PackageHandle
                        drop
                        isPublic={pkg.is_public}
                        isTeam={pkg.is_team}
                        name={pkg.name}
                        owner={pkg.owner}
                        showPrefix={showPrefix}
                      />
                    </StyledLink>
                  </BodyCell>
                  <BodyCell>
                    {readableBytes(pkg.size)}
                  </BodyCell>
                  <BodyCell>
                    <Value>
                      {readableQuantity(pkg.installsRecent)}
                    </Value>
                    <Value>
                      {readableQuantity(pkg.installs)}
                    </Value>
                  </BodyCell>
                  <BodyCell>
                    <Value>
                      {readableQuantity(pkg.viewsRecent)}
                    </Value>
                    <Value>
                      {readableQuantity(pkg.views)}
                    </Value>
                  </BodyCell>
                  <BodyCell>
                    <FD value={pkg.updatedOn} />
                  </BodyCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ));
