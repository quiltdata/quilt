/* Admin */
import Checkbox from 'material-ui/Checkbox';
import FlatButton from 'material-ui/FlatButton';
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

import makeSelectAdmin from './selectors';
import messages from './messages';

export class Admin extends React.PureComponent { // eslint-disable-line react/prefer-stateless-function
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
        <MembersTable />
      </div>
    );
  }
}

Admin.propTypes = {
  dispatch: PropTypes.func.isRequired,
  teamName: PropTypes.string,
};

const MembersTable = () => (
  <Table>
    <TableHeader adjustForCheckbox={false} displaySelectAll={false}>
      <TableRow>
        <TableHeaderColumn>ID</TableHeaderColumn>
        <TableHeaderColumn>Name</TableHeaderColumn>
        <TableHeaderColumn>Status</TableHeaderColumn>
      </TableRow>
    </TableHeader>
    <TableBody displayRowCheckbox={false}>
      <TableRow>
        <TableRowColumn>1</TableRowColumn>
        <TableRowColumn>John Smith</TableRowColumn>
        <TableRowColumn>Employed</TableRowColumn>
      </TableRow>
      <TableRow>
        <TableRowColumn>2</TableRowColumn>
        <TableRowColumn>Randal White</TableRowColumn>
        <TableRowColumn>Unemployed</TableRowColumn>
      </TableRow>
      <TableRow>
        <TableRowColumn>3</TableRowColumn>
        <TableRowColumn>Stephanie Sanders</TableRowColumn>
        <TableRowColumn>Employed</TableRowColumn>
      </TableRow>
      <TableRow>
        <TableRowColumn>4</TableRowColumn>
        <TableRowColumn>Steve Brown</TableRowColumn>
        <TableRowColumn>Employed</TableRowColumn>
      </TableRow>
      <TableRow>
        <TableRowColumn>5</TableRowColumn>
        <TableRowColumn>Christopher Nolan</TableRowColumn>
        <TableRowColumn>Unemployed</TableRowColumn>
      </TableRow>
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
