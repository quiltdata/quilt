/* Confirm */
import PropTypes from 'prop-types';
import React from 'react';
import Dialog from 'material-ui/Dialog';
import FlatButton from 'material-ui/FlatButton';

export default class Confirm extends React.Component {
  handleConfirm = () => {
    this.props.onConfirm();
    this.props.onRequestClose();
  }

  render() {
    const actions = [
      <FlatButton
        label="Cancel"
        secondary
        onClick={this.props.onRequestClose}
      />,
      <FlatButton
        label="Downgrade"
        onClick={this.handleConfirm}
      />,
    ];

    return (
      <Dialog
        title="Confirm"
        actions={actions}
        modal
        open={this.props.open}
      >
        Are you sure you want to downgrade?
      </Dialog>
    );
  }
}

Confirm.propTypes = {
  onConfirm: PropTypes.func.isRequired,
  onRequestClose: PropTypes.func.isRequired,
  open: PropTypes.bool.isRequired,
};
