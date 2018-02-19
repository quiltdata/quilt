import FlatButton from 'material-ui/FlatButton';
import {
  Table,
  TableBody,
  TableHeader,
  TableHeaderColumn,
  TableRow,
} from 'material-ui/Table';
import PT from 'prop-types';
import React, { Fragment } from 'react';
import { FormattedMessage } from 'react-intl';
import { compose, setPropTypes, setDisplayName } from 'recompose';

import Spinner from 'components/Spinner';
import api, { apiStatus } from 'constants/api';

import messages from './messages';
import { branch, formatActivity, formatDate, withStatefulActions } from './util';
import Cell from './LockableCell';
import SettingsMenu from './SettingsMenu';


const packageActivities = [
  'installs',
  'previews',
  // 'deletes',
  // 'pushes',
];

const PackagesTable = compose(
  setPropTypes({
    audit: PT.func.isRequired,
    packages: PT.arrayOf( // eslint-disable-line function-paren-newline
      PT.shape({
        handle: PT.string.isRequired,
        lastModified: PT.number,
      }).isRequired,
    ).isRequired, // eslint-disable-line function-paren-newline
    actions: PT.shape({
      remove: PT.func.isRequired,
    }).isRequired,
  }),
  withStatefulActions((props) => [
    { text: 'Delete', callback: props.remove },
  ]),
  setDisplayName('Admin.Packages.Table'),
// eslint-disable-next-line object-curly-newline
)(({ audit, packages, actions, pending }) => (
  <Table selectable={false}>
    <TableHeader adjustForCheckbox={false} displaySelectAll={false}>
      <TableRow>
        <TableHeaderColumn>Handle</TableHeaderColumn>
        <TableHeaderColumn>Activity</TableHeaderColumn>
        <TableHeaderColumn>Last modified</TableHeaderColumn>
        <TableHeaderColumn>Settings</TableHeaderColumn>
      </TableRow>
    </TableHeader>
    <TableBody displayRowCheckbox={false}>
      {packages.map(({ handle, lastModified, ...activity }) => (
        <TableRow hoverable key={handle}>
          {/* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/anchor-is-valid */}
          <Cell locked={pending[handle]}>
            <a onClick={() => audit(handle)}>{handle}</a>
          </Cell>
          <Cell locked={pending[handle]}>
            <a onClick={() => audit(handle)}>
              {formatActivity(packageActivities, activity)}
            </a>
          </Cell>
          <Cell locked={pending[handle]}>
            <FlatButton onClick={() => audit(handle)}>{formatDate(lastModified)}</FlatButton>
          </Cell>
          <Cell locked={pending[handle]}>
            <SettingsMenu actions={actions} arg={handle} busy={pending[handle]} />
          </Cell>
          {/* eslint-enable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/anchor-is-valid */}
        </TableRow>
      ))}
    </TableBody>
  </Table>
));

const ErrorMessage = compose(
  setPropTypes({
    error: PT.shape({
      message: PT.string,
    }).isRequired,
  }),
  setDisplayName('Admin.Packages.Error'),
)(({ error }) => (
  <p>Error: {error.message}</p>
));

export default compose(
  setPropTypes({
    status: apiStatus,
    response: PT.oneOfType([
      PT.array,
      PT.object,
    ]),
    actions: PT.object.isRequired,
    audit: PT.func.isRequired,
  }),
  setDisplayName('Admin.Packages'),
)(({
  status,
  response,
  actions,
  audit,
}) => (
  <Fragment>
    <h2>
      <FormattedMessage {...messages.teamPackages} />
      {
        branch(status, {
          [api.WAITING]: () => <Spinner />,
          [api.SUCCESS]: () => ` (${response.length})`,
        })
      }
    </h2>
    {
      branch(status, {
        [api.SUCCESS]: () => (
          <PackagesTable
            packages={response}
            audit={audit}
            actions={actions}
          />
        ),
        [api.ERROR]: () => <ErrorMessage error={response} />,
      })
    }
  </Fragment>
));
