/**
*
* LogIn
*
*/

import React from 'react';
// import styled from 'styled-components';

class LogIn extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      username: '',
      password: ''
    };

    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  handleChange(event) {
    this.setState({[event.target.id]: event.target.value});
  }

  handleSubmit() {
    // ajax to try login
  }

  render() {
    return (
      <form onSubmit={this.handleSubmit}>
        <label>
          Userame:
          <input id="username" type="text" value={this.state.username} onChange={this.handleChange} />
        </label>
        <label>
          Password:
          <input id="password" type="password" value={this.state.password} onChange={this.handleChange} />
        </label>
        <input type="submit" value="Submit" />
      </form>
    )
  }
}

LogIn.propTypes = {

};

export default LogIn;
