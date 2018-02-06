/* Admin */
import Checkbox from 'material-ui/Checkbox';
import Dialog from 'material-ui/Dialog';
import Divider from 'material-ui/Divider';
import FlatButton from 'material-ui/FlatButton';
import IconButton from 'material-ui/IconButton';
import IconMenu from 'material-ui/IconMenu';
import MenuItem from 'material-ui/MenuItem';
import React, { PropTypes } from 'react';
import { connect } from 'react-redux';
import { FormattedMessage } from 'react-intl';
import { createStructuredSelector } from 'reselect';
import {
  Table,
  TableBody,
  TableHeader,
  TableHeaderColumn,
  TableRow,
  TableRowColumn,
} from 'material-ui/Table';
import TextField from 'material-ui/TextField';

import MIcon from 'components/MIcon';

import messages from './messages';
import makeSelectAdmin from './selectors';

export class Admin extends React.PureComponent { // eslint-disable-line react/prefer-stateless-function
  state = {
    open: false,
  };
  setOpen(flag) {
    this.setState({ open: flag });
  }
  render() {
    const { teamName } = this.props;
    return (
      <div>
        <h1><FormattedMessage {...messages.teamHeader} values={{ name: teamName.toUpperCase() }} /></h1>
        <h2><FormattedMessage {...messages.teamPolicies} /></h2>
        <Checkbox checked label={<FormattedMessage {...messages.membersRead} />} />
        <Checkbox checked={false} label={<FormattedMessage {...messages.membersWrite} />} />
        <h2><FormattedMessage {...messages.membersAdd} /></h2>
        <TextField hintText="Email" />
        <FlatButton label="Add" />
        <h2><FormattedMessage {...messages.teamMembers} /></h2>
        <MembersTable onOpen={() => this.setOpen(true)} />
        <h2><FormattedMessage {...messages.teamPackages} /></h2>
        <PackageTable />
        <AuditDialog
          onClose={() => this.setOpen(false)}
          open={this.state.open}
        />
      </div>
    );
  }
}

Admin.propTypes = {
  dispatch: PropTypes.func.isRequired,
  teamName: PropTypes.string,
};

const SettingsMenu = () => (
  <IconMenu
    iconButtonElement={<IconButton><MIcon>settings</MIcon></IconButton>}
    anchorOrigin={{ horizontal: 'left', vertical: 'top' }}
    targetOrigin={{ horizontal: 'right', vertical: 'top' }}
  >
    <MenuItem primaryText="Remove member" />
    <Divider style={{ borderBottom: '1px solid' }} />
    <MenuItem primaryText="Reset password" />
  </IconMenu>

);

const now = Date.now();
function rtime() {
  const t = new Date(now - (Math.random() * 1000000000));
  return t.toLocaleString();
}

function randInt(len) {
  return Math.floor(Math.random()*10) + 1;
}

const memberData = [
  { name: 'azander', last_seen: rtime() },
  { name: 'bgross', last_seen: rtime() },
  { name: 'dcaufield', last_seen: rtime() },
  { name: 'emobley', last_seen: rtime() },
  { name: 'fstitches', last_seen: rtime() },
  { name: 'gvanderplas', last_seen: rtime() },
  { name: 'hmcauley', last_seen: rtime() },
  { name: 'hsanders', last_seen: rtime() },
  { name: 'jkarve', last_seen: rtime() },
  { name: 'klimnose', last_seen: rtime() },
];

const activityMask = ['packages', 'installs', 'previews'];
const MembersTable = ({ onOpen }) => (
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
      {
        memberData.map((m) => (
          <TableRow key={m.name}>
            <TableRowColumn><a>{m.name}</a></TableRowColumn>
            <TableRowColumn>
              <a>{ activityMask.map((l) => randInt() + ` ${l}`).join(", ")}</a>
            </TableRowColumn>
            <TableRowColumn>
              <FlatButton onClick={onOpen}>{m.last_seen}</FlatButton>
            </TableRowColumn>
            <TableRowColumn><SettingsMenu /></TableRowColumn>
          </TableRow>
        ))
      }
    </TableBody>
  </Table>
);

MembersTable.propTypes = {
  onOpen: PropTypes.func,
};

const packageData = [
  { name: 'emobley/commodities', last_seen: rtime() },
  { name: 'emobley/models', last_seen: rtime() },
  { name: 'fstitches/imagedb1', last_seen: rtime() },
  { name: 'fstitches/imagedb2', last_seen: rtime() },
  { name: 'fstitches/imagedb3', last_seen: rtime() },
  { name: 'rob/arbitrage', last_seen: rtime() },
  { name: 'rob/bonds', last_seen: rtime() },
  { name: 'rob/imds', last_seen: rtime() },
  { name: 'rob/treasuries', last_seen: rtime() },
  { name: 'rob/value', last_seen: rtime() },
];

const PackageSettingsMenu = () => (
  <IconMenu
    iconButtonElement={<IconButton><MIcon>settings</MIcon></IconButton>}
    anchorOrigin={{ horizontal: 'left', vertical: 'top' }}
    targetOrigin={{ horizontal: 'right', vertical: 'top' }}
  >
    <MenuItem primaryText="Delete" />
  </IconMenu>

);

const PackageTable = () => (
  <Table selectable={false}>
    <TableHeader adjustForCheckbox={false} displaySelectAll={false}>
      <TableRow>
        <TableHeaderColumn>Name</TableHeaderColumn>
        <TableHeaderColumn>Activity</TableHeaderColumn>
        <TableHeaderColumn>Last modified</TableHeaderColumn>
        <TableHeaderColumn>Settings</TableHeaderColumn>
      </TableRow>
    </TableHeader>
    <TableBody displayRowCheckbox={false}>
      {
        packageData.map((p) => (
          <TableRow hoverable key={p.name}>
            <TableRowColumn><a>{p.name}</a></TableRowColumn>
            <TableRowColumn>
              <a>{ activityMask.slice(1).map((l) => randInt() + ` ${l}`).join(", ") }</a>
            </TableRowColumn>
            <TableRowColumn><FlatButton> {p.last_seen} </FlatButton></TableRowColumn>
            <TableRowColumn><PackageSettingsMenu /></TableRowColumn>
          </TableRow>
        ))
      }
    </TableBody>
  </Table>
);

const AuditDialog = ({ onClose, open }) => {
  const actions = [
    <FlatButton
      label="Close"
      primary
      onClick={onClose}
    />,
  ];

  return (
    <Dialog
      title="User Audit"
      actions={actions}
      contentStyle={{ width: '80%', maxWidth: 'none' }}
      modal
      open={open}
    >
      <AuditTable />
    </Dialog>
  );
};

AuditDialog.propTypes = {
  onClose: PropTypes.func,
  open: PropTypes.bool,
};

const AuditTable = () => (
  <Table selectable={false}>
    <TableHeader adjustForCheckbox={false} displaySelectAll={false}>
      <TableRow>
        <TableHeaderColumn>Time</TableHeaderColumn>
        <TableHeaderColumn>Package</TableHeaderColumn>
        <TableHeaderColumn>Event</TableHeaderColumn>
      </TableRow>
    </TableHeader>
    <TableBody displayRowCheckbox={false}>
      {
        packageData.map((p) => (
          <TableRow hoverable key={p.name}>
            <TableRowColumn><FlatButton> {p.last_seen} </FlatButton></TableRowColumn>
            <TableRowColumn><a>{p.name}</a></TableRowColumn>
            <TableRowColumn>{ ['preview', 'install', 'push'][Math.floor(Math.random() * 3)]}</TableRowColumn>
          </TableRow>
        ))
      }
    </TableBody>
  </Table>
);

const mapStateToProps = createStructuredSelector({
  Admin: makeSelectAdmin(),
});

function mapDispatchToProps(dispatch) {
  return {
    dispatch,
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(Admin);
