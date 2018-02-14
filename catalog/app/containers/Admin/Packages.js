const activityMask = ['packages', 'installs', 'previews'];

function randInt() {
  return Math.floor(Math.random() * 10) + 1;
}
export default const Packages = ({ }) => (
    <h2><FormattedMessage {...messages.teamPackages} /></h2>
    {/*<PackageTable />*/}

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
            <TableRowColumn><a href="#TODO">{p.name}</a></TableRowColumn>
            <TableRowColumn>
              <a href="#TODO">
                {activityMask.slice(1).map((l) => `${randInt()} ${l}`).join(', ')}
              </a>
            </TableRowColumn>
            <TableRowColumn><FlatButton> {p.last_seen} </FlatButton></TableRowColumn>
            <TableRowColumn><PackageSettingsMenu /></TableRowColumn>
          </TableRow>
        ))
      }
    </TableBody>
  </Table>
);
