'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _rx = require('rx');

var _rx2 = _interopRequireDefault(_rx);

var _chalk = require('chalk');

var _chalk2 = _interopRequireDefault(_chalk);

var _prettyMs = require('pretty-ms');

var _prettyMs2 = _interopRequireDefault(_prettyMs);

var _hirestime = require('hirestime');

var _hirestime2 = _interopRequireDefault(_hirestime);

var _pad = require('./pad');

var _pad2 = _interopRequireDefault(_pad);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = function (input$) {
  var timer = (0, _hirestime2.default)();
  var output$ = new _rx2.default.Subject();

  // Output the results
  input$.results$.forEach(function (line) {
    switch (line.name) {
      case 'tests':
        {
          output$.onNext((0, _pad2.default)(_chalk2.default.bgWhite.black(' ASSERTIONS ') + '     ' + _chalk2.default.white(line.count)));
          break;
        }

      case 'pass':
        {
          output$.onNext((0, _pad2.default)(_chalk2.default.bgGreen.black(' PASSED ') + '         ' + _chalk2.default.green(line.count)));
          break;
        }

      case 'fail':
        {
          if (line.count > 0) {
            output$.onNext((0, _pad2.default)(_chalk2.default.bgRed.black(' FAILED ') + '         ' + _chalk2.default.red(line.count)));
          }
          break;
        }
      default:
        output$.onNext('');
    }
  }, function () {
    output$.onNext('\n');
    output$.onNext(_chalk2.default.red.bold('PARSING ERROR:'), 'There was an error in the TAP parsing. Please open an issue at', _chalk2.default.underline('https://github.com/scottcorgan/tap-out/issues.'));
  }, function () {
    output$.onNext('\n');
    output$.onNext((0, _pad2.default)(_chalk2.default.bgYellow.black(' DURATION ') + '       ' + _chalk2.default.yellow((0, _prettyMs2.default)(timer()))));
    output$.onNext('\n');
  });

  return output$;
};