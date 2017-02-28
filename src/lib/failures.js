import { diffChars } from 'diff';
import figures from 'figures';
import format from 'chalk';
import R from 'ramda';
import Rx from 'rx';
import pad from './pad';

const indent = R.pipe(pad, pad);
const errorIndent = R.pipe(indent, pad);
const addExtraIndent = R.pipe(R.defaultTo(0), R.repeat(' '), R.join(''));
const formatDiff = R.pipe(
  diffChars,
  R.map((part) => {
    let color = 'dim';
    let prefix = '';

    if (part.removed) {
      color = 'red';
      prefix = '-';
    }
    if (part.added) {
      color = 'green';
      prefix = '+';
    }
    return format[color](`${prefix} ${part.value}`);
  }),
  R.join(''),
);

export const formatAssertionError = (line, extraIndent) => {
  const diffs = formatDiff(String(line.diagnostic.expected), String(line.diagnostic.actual));
  const output = [];

  output.push(indent(format.red.bold(`${figures.cross} ${line.title}`)));
  output.push(indent(format.dim('  at ') + format.dim(line.diagnostic.at)));
  output.push('');
  output.push(errorIndent(`${format.green('actual')} ${format.red('expected')}`));
  output.push('');
  output.push(errorIndent(diffs));
  output.push('');

  return output
    .map(input => addExtraIndent(extraIndent) + input)
    .join('\n');
};


export default (input$) => {
  const output$ = new Rx.Subject();

  // Failure Title
  input$.failingAssertions$
    .count()
    .forEach((failureCount) => {
      if (failureCount < 1) {
        return output$.onCompleted();
      }

      const past = failureCount === 1 ? 'was' : 'were';
      const plural = failureCount === 1 ? 'failure' : 'failures';
      const title = [
        format.bgRed.black.bold(' FAILED TESTS '),
        `There ${past} ${format.red.bold(failureCount)} ${plural}`,
      ].join(' ');

      output$.onNext(pad(title));
      return output$.onNext('');
    });

  // Output failures
  Rx.Observable
    .merge(
      input$.tests$,
      input$.failingAssertions$,
    )
    .scan((_accum, item) => {
      const accum = _accum;
      if (item.type === 'test') {
        accum[item.testNumber] = {
          test: item,
          assertions: [],
        };
      } else {
        accum[item.testNumber].assertions.push(item);
      }

      return accum;
    }, {})
    .takeLast(1)
    .forEach((group) => {
      Object.keys(group)
        .filter(number => group[number].assertions.length > 0)
        .map(number => group[number])
        .forEach((set) => {
          output$.onNext(pad(pad(set.test.title)));
          set.assertions
            .forEach((assertion) => {
              output$.onNext(formatAssertionError(assertion, 2));
            });

          output$.onNext('');
        });

      output$.onCompleted();
    });

  return output$;
};
