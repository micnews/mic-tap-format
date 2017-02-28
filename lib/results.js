import Rx from 'rx';
import format from 'chalk';
import prettyMs from 'pretty-ms';
import hirestime from 'hirestime';
import pad from './pad';

export default (input$) => {
  const timer = hirestime();
  const output$ = new Rx.Subject();

  // Output the results
  input$.results$
    .forEach(
      (line) => {
        switch (line.name) {
          case 'tests': {
            output$.onNext(pad(`assertions:  ${line.count}`));
            break;
          }

          case 'pass': {
            output$.onNext(pad(format.green(`passing:     ${line.count}`)));
            break;
          }

          case 'fail': {
            if (line.count > 0) {
              output$.onNext(pad(format.red(`failing:     ${line.count}`)));
            }
            break;
          }
          default:
            output$.onNext('');
        }
      },
      () => {
        output$.onNext('\n');
        output$.onNext(
          format.red.bold('PARSING ERROR:'),
          'There was an error in the TAP parsing. Please open an issue at',
          format.underline('https://github.com/scottcorgan/tap-out/issues.'),
        );
      },
      () => {
        output$.onNext(pad(`duration:    ${prettyMs(timer())}`));
        output$.onNext('\n');
      },
    );

  return output$;
};
