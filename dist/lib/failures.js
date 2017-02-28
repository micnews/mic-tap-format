'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.formatAssertionError = undefined;

var _diff = require('diff');

var _figures = require('figures');

var _figures2 = _interopRequireDefault(_figures);

var _chalk = require('chalk');

var _chalk2 = _interopRequireDefault(_chalk);

var _ramda = require('ramda');

var _ramda2 = _interopRequireDefault(_ramda);

var _rx = require('rx');

var _rx2 = _interopRequireDefault(_rx);

var _pad = require('./pad');

var _pad2 = _interopRequireDefault(_pad);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var indent = _ramda2.default.pipe(_pad2.default, _pad2.default);
var errorIndent = _ramda2.default.pipe(indent, _pad2.default);
var addExtraIndent = _ramda2.default.pipe(_ramda2.default.defaultTo(0), _ramda2.default.repeat(' '), _ramda2.default.join(''));
var formatDiff = _ramda2.default.pipe(_diff.diffChars, _ramda2.default.map(function (part) {
  var color = 'dim';
  var prefix = '';

  if (part.removed) {
    color = 'red';
    prefix = '-';
  }
  if (part.added) {
    color = 'green';
    prefix = '+';
  }
  return _chalk2.default[color](prefix + ' ' + part.value);
}), _ramda2.default.join(''));

var formatAssertionError = exports.formatAssertionError = function formatAssertionError(line, extraIndent) {
  var diffs = formatDiff(String(line.diagnostic.expected), String(line.diagnostic.actual));
  var output = [];

  output.push(indent(_chalk2.default.red.bold(_figures2.default.cross + ' ' + line.title)));
  output.push(indent(_chalk2.default.dim('  at ') + _chalk2.default.dim(line.diagnostic.at)));
  output.push('');
  output.push(errorIndent(_chalk2.default.green('actual') + ' ' + _chalk2.default.red('expected')));
  output.push('');
  output.push(errorIndent(diffs));
  output.push('');

  return output.map(function (input) {
    return addExtraIndent(extraIndent) + input;
  }).join('\n');
};

exports.default = function (input$) {
  var output$ = new _rx2.default.Subject();

  // Failure Title
  input$.failingAssertions$.count().forEach(function (failureCount) {
    if (failureCount < 1) {
      return output$.onCompleted();
    }

    var past = failureCount === 1 ? 'was' : 'were';
    var plural = failureCount === 1 ? 'failure' : 'failures';
    var title = [_chalk2.default.bgRed.black.bold(' FAILED TESTS '), 'There ' + past + ' ' + _chalk2.default.red.bold(failureCount) + ' ' + plural].join(' ');

    output$.onNext((0, _pad2.default)(title));
    return output$.onNext('');
  });

  // Output failures
  _rx2.default.Observable.merge(input$.tests$, input$.failingAssertions$).scan(function (_accum, item) {
    var accum = _accum;
    if (item.type === 'test') {
      accum[item.testNumber] = {
        test: item,
        assertions: []
      };
    } else {
      accum[item.testNumber].assertions.push(item);
    }

    return accum;
  }, {}).takeLast(1).forEach(function (group) {
    Object.keys(group).filter(function (number) {
      return group[number].assertions.length > 0;
    }).map(function (number) {
      return group[number];
    }).forEach(function (set) {
      output$.onNext((0, _pad2.default)((0, _pad2.default)(set.test.title)));
      set.assertions.forEach(function (assertion) {
        output$.onNext(formatAssertionError(assertion, 2));
      });

      output$.onNext('');
    });

    output$.onCompleted();
  });

  return output$;
};