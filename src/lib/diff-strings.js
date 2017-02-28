import chalk from 'chalk';
import { structuredPatch, diffLines } from 'diff';

const NO_DIFF_MESSAGE = 'No diff message ';
const DIFF_CONTEXT  = 5;

const getColor = (added, removed) =>
  added ? chalk.red : removed ? chalk.green : chalk.dim;

const getBgColor = (added, removed) =>
  added ? chalk.bgRed : removed ? chalk.bgGreen : chalk.dim;

const highlightTrailingWhitespace = (line, bgColor) =>
  line.replace(/\s+$/, bgColor('$&'));

const getAnnotation = (options) =>
  chalk.green('- ' + ((options && options.aAnnotation) || 'Expected')) + '\n' +
  chalk.red('+ ' + ((options && options.bAnnotation) || 'Received')) + '\n\n';

const _diffLines = (a, b) => {
  let isDifferent = false;
  return {
    diff: diffLines(a, b).map((part) => {
      const { added, removed } = part;
      if (part.added || part.removed) {
        isDifferent = true;
      }

      const lines = part.value.split('\n');
      const color = getColor(added, removed);
      const bgColor = getBgColor(added, removed);

      if (lines[lines.length - 1] === '') {
        lines.pop();
      }

      return lines.map((line) => {
        const highlightedLine = highlightTrailingWhitespace(line, bgColor);
        const mark = color(part.added ? '+' : part.removed ? '-' : ' ');
        return mark + ' ' + color(highlightedLine) + '\n';
      }).join('');
    }).join('').trim(),
    isDifferent,
  };
};

// Only show patch marks ("@@ ... @@") if the diff is big.
// To determine this, we need to compare either the original string (a) to
// `hunk.oldLines` or a new string to `hunk.newLines`.
// If the `oldLinesCount` is greater than `hunk.oldLines`
// we can be sure that at least 1 line has been "hidden".
const shouldShowPatchMarks = (hunk, oldLinesCount) => oldLinesCount > hunk.oldLines;

const createPatchMark = (hunk) => {
  const markOld = `-${hunk.oldStart},${hunk.oldLines}`;
  const markNew = `+${hunk.newStart},${hunk.newLines}`;
  return chalk.yellow(`@@ ${markOld} ${markNew} @@\n`);
};

const _structuredPatch = (a, b) => {
  const options = { context: DIFF_CONTEXT };
  let isDifferent = false;
  // Make sure the strings end with a newline.
  if (!a.endsWith('\n')) {
    a += '\n';
  }
  if (!b.endsWith('\n')) {
    b += '\n';
  }

  const oldLinesCount = (a.match(/\n/g) || []).length;

  return {
    diff: structuredPatch('', '', a, b, '', '', options)
      .hunks.map((hunk) => {
        const lines = hunk.lines.map(line => {
          const added = line[0] === '+';
          const removed = line[0] === '-';

          const color = getColor(added, removed);
          const bgColor = getBgColor(added, removed);

          const highlightedLine = highlightTrailingWhitespace(line, bgColor);
          return color(highlightedLine) + '\n';
        }).join('');

        isDifferent = true;
        return shouldShowPatchMarks(hunk, oldLinesCount)
          ? createPatchMark(hunk) + lines
          : lines;
      }).join('').trim(),
    isDifferent,
  };
};

function diffStrings(a, b, options) {
  // `diff` uses the Myers LCS diff algorithm which runs in O(n+d^2) time
  // (where "d" is the edit distance) and can get very slow for large edit
  // distances. Mitigate the cost by switching to a lower-resolution diff
  // whenever linebreaks are involved.
  const result = options && options.expand === false
    ? _structuredPatch(a, b)
    : _diffLines(a, b);

  if (result.isDifferent) {
    return getAnnotation(options) + result.diff;
  } else {
    return NO_DIFF_MESSAGE;
  }
}

module.exports = diffStrings;
