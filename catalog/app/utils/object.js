/* object utils */
isEmpty(obj) {
  return Object.keys(obj).length === 0
    && obj.constructor === Object;
    // ^ avoid Object.keys(new Date()).length === 0
}