import {
  Table,
  TableBody,
  TableHeader,
  TableHeaderColumn,
  TableRow,
  TableRowColumn,
} from 'material-ui/Table';
import PT from 'prop-types';
import React, { Fragment } from 'react';
import { compose, setPropTypes, setDisplayName, withProps } from 'recompose';

import SettingsMenu from './SettingsMenu'
import { formatActivity, formatDate } from './util'

const memberActivities = [
  'packages',
  'installs',
  'previews',
  // 'deletes',
  // 'pushes',
];

const MemberRow = compose(
  setPropTypes({
    audit: PT.func.isRequired,
    name: PT.string.isRequired,
    last_seen: PT.any, //TODO: specify
    actions: PT.array.isRequired,
  }),
  setDisplayName('Admin.Members.Row'),
)(({ audit, name, last_seen, actions, ...activity }) => (
  <TableRow>
    <TableRowColumn><a onClick={audit}>{name}</a></TableRowColumn>
    <TableRowColumn>
      <a onClick={audit}>{formatActivity(memberActivities, activity)}</a>
    </TableRowColumn>
    <TableRowColumn>
      <FlatButton onClick={audit}>{formatDate(last_seen)}</FlatButton>
    </TableRowColumn>
    <TableRowColumn>
      <SettingsMenu actions={actions} />
    </TableRowColumn>
  </TableRow>
));

const MembersTable = compose(
  setPropTypes({
    audit: PT.func.isRequired,
    members: PT.array.isRequired,
    remove: PT.func.isRequired,
    resetPassword: PT.func.isRequired,
  }),
  withProps(({ remove, resetPassword }) => ({
    actions: [
      { text: 'Remove member', callback: remove }, //TODO: bind
      'divider'
      { text: 'Reset password', callback: resetPassword }, //TODO: bind
    ],
  })),
  setDisplayName('Admin.Members.Table'),
)(({ audit, members, actions }) => (
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
      {members.map((m) => <MemberRow key={m.name} audit={audit} {...m} actions={actions} />)}
    </TableBody>
  </Table>
));

const ErrorMessage = compose(
  setPropTypes({
    error: PT.shape({
      message: PT.string,
    }).isRequired,
  }),
  setDisplayName('Admin.Members.Error'),
)(({ error }) => (
  <p>Error: {error.message}</p>
));

export default compose(
  setPropTypes({
    audit: PT.func.isRequired,
    status: PT.oneOf([api.WAITING, api.SUCCESS, api.ERROR]).isRequired,
    response: PT.array,
    remove: PT.func.isRequired,
    resetPassword: PT.func.isRequired,
  }),
  setDisplayName('Admin.Members'),
)(({
  audit,
  status,
  response,
  remove,
  resetPassword,
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
            audit={audit}
            members={response}
            remove={remove}
            resetPassword={resetPassword}
          />
        ),
        [api.ERROR]: () => <ErrorMessage error={response} />,
      })
    }
  </Fragment>
));
