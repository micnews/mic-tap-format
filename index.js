const Rx = require('rx');
const figures = require('figures');
const format = require('chalk');
const formatFailures = require('./lib/failures');
const formatResults = require('./lib/results');
const exitOnFailure = require('./lib/exit');

const formatAssertionError = formatFailures.formatAssertionError;

const exports = module.exports = function (input$) {
  return Rx.Observable
    .merge(
      formatTestsAndAssertions(input$),
      formatFailures(input$),
      formatResults(input$),
      exitOnFailure(input$),
    );
};

exports.format = formatTestsAndAssertions;

function formatTestsAndAssertions(input$) {
  const output$ = new Rx.Subject();

  input$.tests$
    .forEach((line) => {
      output$.onNext('');
      output$.onNext(pad(format.bold(line.title)));
    });

  input$.passingAssertions$
    .forEach((line) => {
      let output = pad(pad());
      const fig = figures[line.ok ? 'tick' : 'cross'];
      output += format[line.ok ? 'green' : 'red'](`${fig} `);
      output += format.dim(line.title);

      output$.onNext(output);
    });

  input$.failingAssertions$
    .map(formatAssertionError)
    .forEach((formattedLine) => {
      output$.onNext(formattedLine);
    });

  input$.assertions$
    .subscribeOnCompleted(() => {
      output$.onNext('\n');
    });

  input$.comments$
    .forEach((comment) => {
      const line = pad(pad(comment.title));
      output$.onNext(format.yellow(line));
    });

  return output$;
}

function pad(str) {
  str = str || '';
  return `  ${str}`;
}
