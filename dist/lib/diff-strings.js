'use strict';

var _chalk = require('chalk');

var _chalk2 = _interopRequireDefault(_chalk);

var _diff = require('diff');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var NO_DIFF_MESSAGE = 'No diff message ';
var DIFF_CONTEXT = 5;

var getColor = function getColor(added, removed) {
  return added ? _chalk2.default.red : removed ? _chalk2.default.green : _chalk2.default.dim;
};

var getBgColor = function getBgColor(added, removed) {
  return added ? _chalk2.default.bgRed : removed ? _chalk2.default.bgGreen : _chalk2.default.dim;
};

var highlightTrailingWhitespace = function highlightTrailingWhitespace(line, bgColor) {
  return line.replace(/\s+$/, bgColor('$&'));
};

var getAnnotation = function getAnnotation(options) {
  return _chalk2.default.green('- ' + (options && options.aAnnotation || 'Expected')) + '\n' + _chalk2.default.red('+ ' + (options && options.bAnnotation || 'Received')) + '\n\n';
};

var _diffLines = function _diffLines(a, b) {
  var isDifferent = false;
  return {
    diff: (0, _diff.diffLines)(a, b).map(function (part) {
      var added = part.added,
          removed = part.removed;

      if (part.added || part.removed) {
        isDifferent = true;
      }

      var lines = part.value.split('\n');
      var color = getColor(added, removed);
      var bgColor = getBgColor(added, removed);

      if (lines[lines.length - 1] === '') {
        lines.pop();
      }

      return lines.map(function (line) {
        var highlightedLine = highlightTrailingWhitespace(line, bgColor);
        var mark = color(part.added ? '+' : part.removed ? '-' : ' ');
        return mark + ' ' + color(highlightedLine) + '\n';
      }).join('');
    }).join('').trim(),
    isDifferent: isDifferent
  };
};

// Only show patch marks ("@@ ... @@") if the diff is big.
// To determine this, we need to compare either the original string (a) to
// `hunk.oldLines` or a new string to `hunk.newLines`.
// If the `oldLinesCount` is greater than `hunk.oldLines`
// we can be sure that at least 1 line has been "hidden".
var shouldShowPatchMarks = function shouldShowPatchMarks(hunk, oldLinesCount) {
  return oldLinesCount > hunk.oldLines;
};

var createPatchMark = function createPatchMark(hunk) {
  var markOld = '-' + hunk.oldStart + ',' + hunk.oldLines;
  var markNew = '+' + hunk.newStart + ',' + hunk.newLines;
  return _chalk2.default.yellow('@@ ' + markOld + ' ' + markNew + ' @@\n');
};

var _structuredPatch = function _structuredPatch(a, b) {
  var options = { context: DIFF_CONTEXT };
  var isDifferent = false;
  // Make sure the strings end with a newline.
  if (!a.endsWith('\n')) {
    a += '\n';
  }
  if (!b.endsWith('\n')) {
    b += '\n';
  }

  var oldLinesCount = (a.match(/\n/g) || []).length;

  return {
    diff: (0, _diff.structuredPatch)('', '', a, b, '', '', options).hunks.map(function (hunk) {
      var lines = hunk.lines.map(function (line) {
        var added = line[0] === '+';
        var removed = line[0] === '-';

        var color = getColor(added, removed);
        var bgColor = getBgColor(added, removed);

        var highlightedLine = highlightTrailingWhitespace(line, bgColor);
        return color(highlightedLine) + '\n';
      }).join('');

      isDifferent = true;
      return shouldShowPatchMarks(hunk, oldLinesCount) ? createPatchMark(hunk) + lines : lines;
    }).join('').trim(),
    isDifferent: isDifferent
  };
};

function diffStrings(a, b, options) {
  // `diff` uses the Myers LCS diff algorithm which runs in O(n+d^2) time
  // (where "d" is the edit distance) and can get very slow for large edit
  // distances. Mitigate the cost by switching to a lower-resolution diff
  // whenever linebreaks are involved.
  var result = options && options.expand === false ? _structuredPatch(a, b) : _diffLines(a, b);

  if (result.isDifferent) {
    return getAnnotation(options) + result.diff;
  } else {
    return NO_DIFF_MESSAGE;
  }
}

module.exports = diffStrings;