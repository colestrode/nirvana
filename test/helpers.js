var _ = require('lodash');

module.exports.promiseFail = function(promise) {
  return promise
    .then(function() {
      throw new Error('Expected promise to fail, but it resolved');
    });
};

module.exports.getHearsCallbackForMessage = function(botkitController, message) {
  var callArgs = _.find(botkitController.hears.args, function(args) {
    var regex = args[0];
    var result = false;

    if (_.isArray(regex)) {
      _.forEach(regex, function(rgx) {
        if (new RegExp(rgx).test(message)) {
          result = true;
        }
      });
    } else {
      result = new RegExp(regex).test(message);
    }

    return result;
  });

  return callArgs ? callArgs[2] : undefined;
};
