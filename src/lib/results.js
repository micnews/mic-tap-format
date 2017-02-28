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
            output$.onNext(pad(`${format.bgWhite.black(' ASSERTIONS ')}     ${format.white(line.count)}`));
            break;
          }

          case 'pass': {
            output$.onNext(pad(`${format.bgGreen.black(' PASSED ')}         ${format.green(line.count)}`));
            break;
          }

          case 'fail': {
            if (line.count > 0) {
              output$.onNext(pad(`${format.bgRed.black(' FAILED ')}         ${format.red(line.count)}`));
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
        output$.onNext('\n');
        output$.onNext(pad(`${format.bgYellow.black(' DURATION ')}       ${format.yellow(prettyMs(timer()))}`));
        output$.onNext('\n');
      },
    );

  return output$;
};
