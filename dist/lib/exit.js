'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _rx = require('rx');

var _rx2 = _interopRequireDefault(_rx);

var _ramda = require('ramda');

var _ramda2 = _interopRequireDefault(_ramda);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function exit(code) {
  process.nextTick(function () {
    process.exit(code);
  });
}

exports.default = function (input$) {
  // Exit on error
  input$.results$.filter(_ramda2.default.pipe(_ramda2.default.path(['name']), _ramda2.default.equals('fail'))).first().forEach(function (line) {
    if (line.count > 0) {
      exit(1);
    }
  });

  // If there is no plan count, it probably means that there was an error up stream
  input$.plans$.count().forEach(function (planCount) {
    if (planCount < 1) {
      exit(1);
    }
  });

  return new _rx2.default.Subject();
};