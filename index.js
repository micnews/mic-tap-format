var Rx = require('rx')
var figures = require('figures')
var format = require('chalk')
var formatFailures = require('./lib/failures')
var formatResults = require('./lib/results')
var exitOnFailure = require('./lib/exit')

var formatAssertionError = formatFailures.formatAssertionError

var exports = module.exports = function (input$) {

  return Rx.Observable
    .merge(
      formatTestsAndAssertions(input$),
      formatFailures(input$),
      formatResults(input$),
      exitOnFailure(input$)
    )
}

exports.format = formatTestsAndAssertions

function formatTestsAndAssertions (input$) {

  var output$ = new Rx.Subject()

  input$.tests$
    .forEach(function (line) {

      output$.onNext('')
      output$.onNext(pad(format.bold(line.title)))
    })

  input$.passingAssertions$
    .forEach(function (line) {

      var output = pad(pad())
      var fig = figures[line.ok ? 'tick' : 'cross']
      output += format[line.ok ? 'green' : 'red'](fig + ' ')
      output += format.dim(line.title)

      output$.onNext(output)
    })

  input$.failingAssertions$
    .map(formatAssertionError)
    .forEach(function (formattedLine) {

      output$.onNext(formattedLine)
    })

  input$.assertions$
    .subscribeOnCompleted(function () {

      output$.onNext('\n')
    })

  input$.comments$
    .forEach(function (comment) {

      var line = pad(pad(comment.title))
      output$.onNext(format.yellow(line))
    })

  return output$
}

function pad (str) {

  str = str || ''
  return '  ' + str
}