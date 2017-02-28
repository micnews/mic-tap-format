'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.formatTestsAndAssertions = undefined;

exports.default = function (input$) {
  return _rx2.default.Observable.merge(formatTestsAndAssertions(input$), (0, _failures2.default)(input$), (0, _results2.default)(input$), (0, _exit2.default)(input$));
};

var _rx = require('rx');

var _rx2 = _interopRequireDefault(_rx);

var _figures = require('figures');

var _figures2 = _interopRequireDefault(_figures);

var _chalk = require('chalk');

var _chalk2 = _interopRequireDefault(_chalk);

var _pad = require('./lib/pad');

var _pad2 = _interopRequireDefault(_pad);

var _failures = require('./lib/failures');

var _failures2 = _interopRequireDefault(_failures);

var _results = require('./lib/results');

var _results2 = _interopRequireDefault(_results);

var _exit = require('./lib/exit');

var _exit2 = _interopRequireDefault(_exit);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var formatTestsAndAssertions = exports.formatTestsAndAssertions = function formatTestsAndAssertions(input$) {
  var output$ = new _rx2.default.Subject();

  input$.tests$.forEach(function (line) {
    output$.onNext('');
    output$.onNext((0, _pad2.default)(_chalk2.default.bold(line.title)));
  });

  input$.passingAssertions$.forEach(function (line) {
    var output = (0, _pad2.default)((0, _pad2.default)());
    var fig = _figures2.default[line.ok ? 'tick' : 'cross'];
    output += _chalk2.default[line.ok ? 'green' : 'red'](fig + ' ');
    output += _chalk2.default.dim(line.title);

    output$.onNext(output);
  });

  input$.failingAssertions$.map(_failures.formatAssertionError).forEach(function (formattedLine) {
    output$.onNext(formattedLine);
  });

  input$.assertions$.subscribeOnCompleted(function () {
    output$.onNext('\n');
  });

  input$.comments$.forEach(function (comment) {
    var line = (0, _pad2.default)((0, _pad2.default)(comment.title));
    output$.onNext(_chalk2.default.yellow(line));
  });

  return output$;
};