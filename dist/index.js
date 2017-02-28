

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.formatTestsAndAssertions = undefined;

exports.default = function (input$) {
  return _rx2.default.Observable.merge(formatTestsAndAssertions(input$), (0, _failures2.default)(input$), (0, _results2.default)(input$), (0, _exit2.default)(input$));
};

const _rx = require('rx');

var _rx2 = _interopRequireDefault(_rx);

const _figures = require('figures');

const _figures2 = _interopRequireDefault(_figures);

const _chalk = require('chalk');

const _chalk2 = _interopRequireDefault(_chalk);

const _pad = require('./lib/pad');

const _pad2 = _interopRequireDefault(_pad);

const _failures = require('./lib/failures');

var _failures2 = _interopRequireDefault(_failures);

const _results = require('./lib/results');

var _results2 = _interopRequireDefault(_results);

const _exit = require('./lib/exit');

var _exit2 = _interopRequireDefault(_exit);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const formatAssertionError = _failures2.default.formatAssertionError;

var formatTestsAndAssertions = exports.formatTestsAndAssertions = function formatTestsAndAssertions(input$) {
  const output$ = new _rx2.default.Subject();

  input$.tests$.forEach((line) => {
    output$.onNext('');
    output$.onNext((0, _pad2.default)(_chalk2.default.bold(line.title)));
  });

  input$.passingAssertions$.forEach((line) => {
    let output = (0, _pad2.default)((0, _pad2.default)());
    const fig = _figures2.default[line.ok ? 'tick' : 'cross'];
    output += _chalk2.default[line.ok ? 'green' : 'red'](`${fig} `);
    output += _chalk2.default.dim(line.title);

    output$.onNext(output);
  });

  input$.failingAssertions$.map(formatAssertionError).forEach((formattedLine) => {
    output$.onNext(formattedLine);
  });

  input$.assertions$.subscribeOnCompleted(() => {
    output$.onNext('\n');
  });

  input$.comments$.forEach((comment) => {
    const line = (0, _pad2.default)((0, _pad2.default)(comment.title));
    output$.onNext(_chalk2.default.yellow(line));
  });

  return output$;
};
