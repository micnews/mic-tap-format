import Rx from 'rx';
import figures from 'figures';
import format from 'chalk';
import pad from './lib/pad';
import formatFailures, { formatAssertionError } from './lib/failures';
import formatResults from './lib/results';
import exitOnFailure from './lib/exit';

export const formatTestsAndAssertions = (input$) => {
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
};


export default function (input$) {
  return Rx.Observable
    .merge(
      formatTestsAndAssertions(input$),
      formatFailures(input$),
      formatResults(input$),
      exitOnFailure(input$),
    );
}
