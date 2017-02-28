var Rx = require('rx')
var format = require('chalk')
var prettyMs = require('pretty-ms')
var hirestime = require('hirestime')

module.exports = function (input$) {

  var timer = hirestime()
  var output$ = new Rx.Subject()

  // Output the results
  input$.results$
    .forEach(
      function (line) {

        switch (line.name) {
          case 'tests': {
            output$.onNext(pad('assertions:  ' + line.count))
            break
          }

          case 'pass': {
            output$.onNext(pad(format.green('passing:     ' + line.count)))
            break
          }

          case 'fail': {
            if (line.count > 0) {
              output$.onNext(pad(format.red('failing:     ' + line.count)))
            }
            break
          }
        }
      },
      function () {

        output$.onNext('\n')
        output$.onNext(
          format.red.bold('PARSING ERROR:'),
          'There was an error in the TAP parsing. Please open an issue at',
          format.underline('https://github.com/scottcorgan/tap-out/issues.')
        )
      },
      function () {

        output$.onNext(pad('duration:    ' + prettyMs(timer())))
        output$.onNext('\n')
      }
    )

  return output$
}

function pad (str) {

  str = str || ''
  return '  ' + str
}