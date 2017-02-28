import Rx from 'rx';
import R from 'ramda';

function exit(code) {
  process.nextTick(() => { process.exit(code); });
}

export default (input$) => {
  // Exit on error
  input$.results$
    .filter(R.pipe(R.path(['name']), R.equals('fail')))
    .first()
    .forEach((line) => {
      if (line.count > 0) {
        exit(1);
      }
    });

  // If there is no plan count, it probably means that there was an error up stream
  input$.plans$
    .count()
    .forEach((planCount) => {
      if (planCount < 1) {
        exit(1);
      }
    });

  return new Rx.Subject();
};
