const { readFile } = require('fs');
const template = require('lodash/template');

const interpolate = /\$(\w+)/g;

const createTemplate = (str) => template(str, { interpolate });

const loadFile = (path) =>
  new Promise((resolve, reject) =>
    readFile(path, (err, file) => err ? reject(err) : resolve(file)));

module.exports = (path, env) => (_req, res, next) =>
  loadFile(path)
    .then((file) => createTemplate(file)(env))
    .then((result) => res.type('js').send(result))
    .catch(next);
