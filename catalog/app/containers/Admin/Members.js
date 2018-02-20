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
import { Link } from 'react-router';
import { compose, setPropTypes, setDisplayName } from 'recompose';

import Spinner from 'components/Spinner';
import api, { apiStatus } from 'constants/api';

import messages from './messages';
import { branch, formatActivity, formatDate, withStatefulActions } from './util';
import ErrorMessage from './ErrorMessage';
import Cell from './LockableCell';
import SettingsMenu from './SettingsMenu';


const memberActivities = [
  'packages',
  'installs',
  'previews',
  // 'deletes',
  // 'pushes',
];

const MembersTable = compose(
  setPropTypes({
    audit: PT.func.isRequired,
    members: PT.arrayOf( // eslint-disable-line function-paren-newline
      PT.shape({
        name: PT.string.isRequired,
        lastSeen: PT.string,
      }).isRequired,
    ).isRequired, // eslint-disable-line function-paren-newline
    actions: PT.shape({
      remove: PT.func.isRequired,
      resetPassword: PT.func.isRequired,
    }).isRequired,
  }),
  withStatefulActions((props) => [
    { text: 'Remove member', callback: props.remove },
    'divider',
    { text: 'Reset password', callback: props.resetPassword },
  ]),
  setDisplayName('Admin.Members.Table'),
// eslint-disable-next-line object-curly-newline
)(({ audit, members, actions, pending }) => (
  <Table selectable={false}>
    <TableHeader adjustForCheckbox={false} displaySelectAll={false}>
      <TableRow>
        <TableHeaderColumn>Name</TableHeaderColumn>
        <TableHeaderColumn>Activity</TableHeaderColumn>
        <TableHeaderColumn>Last seen</TableHeaderColumn>
        <TableHeaderColumn>Settings</TableHeaderColumn>
      </TableRow>
    </TableHeader>
    <TableBody displayRowCheckbox={false}>
      {members.map(({ name, lastSeen, ...activity }) => (
        <TableRow hoverable key={name}>
          <Cell locked={pending[name]}><Link to={`/user/${name}`}>{name}</Link></Cell>
          <Cell locked={pending[name]}>
            {/* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/anchor-is-valid */}
            <a onClick={() => audit(name)}>{formatActivity(memberActivities, activity)}</a>
            {/* eslint-enable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/anchor-is-valid */}
          </Cell>
          <Cell locked={pending[name]}>{formatDate(lastSeen)}</Cell>
          <Cell locked={pending[name]}>
            <SettingsMenu actions={actions} arg={name} busy={pending[name]} />
          </Cell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
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
  setDisplayName('Admin.Members'),
)(({
  status,
  response,
  actions,
  audit,
}) => (
  <Fragment>
    <h2>
      <FormattedMessage {...messages.teamMembers} />
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
          <MembersTable
            members={response}
            audit={audit}
            actions={actions}
          />
        ),
        [api.ERROR]: () => <ErrorMessage error={response} />,
      })
    }
  </Fragment>
));
