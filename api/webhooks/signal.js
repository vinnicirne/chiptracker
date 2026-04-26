const signalHandler = require('../signal');

module.exports = async (req, res) => {
  return signalHandler(req, res);
};
