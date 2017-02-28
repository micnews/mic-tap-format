'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.observeStream = exports.stream = undefined;

var _rx = require('rx');

var _rx2 = _interopRequireDefault(_rx);

var _rxNode = require('rx-node');

var _rxNode2 = _interopRequireDefault(_rxNode);

var _ramda = require('ramda');

var _ramda2 = _interopRequireDefault(_ramda);

var _passthrough = require('readable-stream/passthrough');

var _passthrough2 = _interopRequireDefault(_passthrough);

var _split = require('split');

var _split2 = _interopRequireDefault(_split);

var _duplexer = require('duplexer');

var _duplexer2 = _interopRequireDefault(_duplexer);

var _jsYaml = require('js-yaml');

var _jsYaml2 = _interopRequireDefault(_jsYaml);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var O = _rx2.default.Observable;

var TEST = 'TEST';
var ASSERTION = 'ASSERTION';
var PLAN = 'PLAN';
var VERSION = 'VERSION';
var COMMENT_BLOCK_START = 'COMMENT_BLOCK_START';
var COMMENT_BLOCK_END = 'COMMENT_BLOCK_END';

var COMMENT_BLOCK_PADDING_SIZE = 2;

var REGEXES = {
  test: /^#\s+(.+)/,
  assertion: new RegExp('^(not )?ok\\b(?:(?:\\s+(\\d+))?(?:\\s+(?:(?:\\s*-\\s*)?(.*)))?)?'),
  result: /^# (fail|tests|pass)\s+[0-9]+/,
  plan: /^(\d+)\.\.(\d+)\b(?:\s+#\s+SKIP\s+(.*)$)?/,
  version: /^TAP\s+version\s+(\d+)/i,
  todo: /^(.*?)\s*#\s*TODO\s+(.*)$/,
  skip: /^(.*?)\s*#\s*SKIP\s+(.*)$/
};

var removeCommentBlockPadding = _ramda2.default.map(_ramda2.default.drop(COMMENT_BLOCK_PADDING_SIZE));
var parseYamlBlock = _ramda2.default.pipe(removeCommentBlockPadding, _ramda2.default.join('\n'), _jsYaml2.default.safeLoad);

function getResult$(name, input$) {
  return input$.scan(function (prev) {
    return prev + 1;
  }, 0).last().map(function (count) {
    return {
      type: 'result',
      name: name,
      count: count,
      raw: '# ' + name + ' ' + count
    };
  });
}

function getRawAssertions$(input$) {
  return input$.filter(_ramda2.default.pipe(_ramda2.default.path(['current', 'type']), _ramda2.default.equals(ASSERTION))).map(function (_line, index) {
    var line = _line;
    line.current.assertionNumber = index + 1;
    line.next.assertionNumber = index + 2;
    return line;
  });
}

function getCommentBlockStart$(input$) {
  return input$.filter(_ramda2.default.pipe(_ramda2.default.path(['current', 'type']), _ramda2.default.equals(COMMENT_BLOCK_START)));
}

function getCommentBlockEnd$(input$) {
  return input$.filter(_ramda2.default.pipe(_ramda2.default.path(['current', 'type']), _ramda2.default.equals(COMMENT_BLOCK_END)));
}

function getAssertionsWithComments(assertions$, blocks$) {
  return assertions$.filter(_ramda2.default.pipe(_ramda2.default.path(['next', 'type']), _ramda2.default.equals(COMMENT_BLOCK_START))).flatMap(function (line) {
    return blocks$.take(1).map(function (rawDiagnostic) {
      return {
        raw: line.current.raw,
        lineNumber: line.current.number,
        assertionNumber: line.current.assertionNumber,
        diagnostic: parseYamlBlock(rawDiagnostic),
        rawDiagnostic: rawDiagnostic
      };
    });
  });
}

function getCommentBlocks$(formattedLines$, start$, end$) {
  var parsingCommentBlock = false;
  var currentCommentBlock = [];
  var formatBlock = _ramda2.default.pipe(_ramda2.default.map(_ramda2.default.path(['current', 'raw'])), _ramda2.default.flatten);

  formattedLines$.forEach(function (line) {
    if (parsingCommentBlock) {
      currentCommentBlock.push(line);
    } else {
      currentCommentBlock = [];
    }
  });

  start$.forEach(function (line) {
    currentCommentBlock = [line];
    parsingCommentBlock = true;
  });

  return end$.map(function () {
    parsingCommentBlock = false;
    return formatBlock(currentCommentBlock);
  });
}

function isOk(line) {
  return line === '# ok';
}

function isResult(line) {
  return REGEXES.result.test(line);
}

function isTest(line) {
  return REGEXES.test.test(line) && !isResult(line) && !isOk(line);
}

function isPlan(line) {
  return REGEXES.plan.test(line);
}

function isVersion(line) {
  return REGEXES.version.test(line);
}

function isCommentBlockStart(line) {
  if (line === null || line === undefined) {
    return false;
  }

  return line.indexOf('  ---') === 0;
}

function isCommentBlockEnd(line) {
  if (line === null || line === undefined) {
    return false;
  }

  return line.indexOf('  ...') === 0;
}

function isAssertion(line) {
  return REGEXES.assertion.test(line);
}

function getLineType(line) {
  if (isTest(line)) {
    return TEST;
  }

  if (isAssertion(line)) {
    return ASSERTION;
  }

  if (isPlan(line)) {
    return PLAN;
  }

  if (isVersion(line)) {
    return VERSION;
  }

  if (isCommentBlockStart(line)) {
    return COMMENT_BLOCK_START;
  }

  if (isCommentBlockEnd(line)) {
    return COMMENT_BLOCK_END;
  }
  return '';
}

function formatCommentObject(line) {
  var raw = line.current.raw;

  return {
    raw: raw,
    title: raw,
    lineNumber: line.current.number,
    type: 'comment'
  };
}

function formatTestObject(line, lineNumber, testNumber) {
  return {
    raw: line,
    type: 'test',
    title: line.replace('# ', ''),
    lineNumber: lineNumber,
    testNumber: testNumber
  };
}

function formatAssertionObject(line, testNumber) {
  var m = REGEXES.assertion.exec(line.raw);
  var rawDiagnostic = '';

  if (line.rawDiagnostic) {
    rawDiagnostic = line.rawDiagnostic.join('\n');
  }

  return {
    type: 'assertion',
    title: m[3],
    raw: line.raw + '\n' + rawDiagnostic,
    ok: !m[1],
    diagnostic: line.diagnostic, // TODO: rename this to "diagnostic",
    rawDiagnostic: rawDiagnostic,
    lineNumber: line.lineNumber,
    testNumber: testNumber,
    assertionNumber: line.assertionNumber
  };
}

function formatPlanObject(line) {
  var m = REGEXES.plan.exec(line);

  return {
    type: 'plan',
    raw: line,
    from: m[1] && Number(m[1]),
    to: m[2] && Number(m[2]),
    skip: m[3]
  };
}

function formatVersionObject(line) {
  return {
    raw: line,
    type: 'version'
  };
}

function formatLinePair(pair, index) {
  return {
    current: {
      raw: pair[0],
      type: getLineType(pair[0]),
      number: index
    },
    next: {
      raw: pair[1],
      type: getLineType(pair[1]),
      number: index + 1
    }
  };
}

function getFormattedTests$(input$) {
  return input$.filter(_ramda2.default.pipe(_ramda2.default.path(['current', 'type']), _ramda2.default.equals(TEST))).map(function (line, index) {
    return formatTestObject(line.current.raw, line.current.number, index + 1);
  });
}

function getFormattedAssertions$(assertions$, commentBlocks$, tests$) {
  var currentTestNumber = 0;
  var assertionsWithComments$ = getAssertionsWithComments(assertions$, commentBlocks$);

  tests$.forEach(function (line) {
    currentTestNumber = line.testNumber;
  });

  return assertions$.filter(_ramda2.default.pipe(_ramda2.default.path(['next', 'type']), _ramda2.default.complement(_ramda2.default.equals(COMMENT_BLOCK_START)))).map(function (line) {
    var formattedLine = _ramda2.default.pipe(_ramda2.default.path(['current']), _ramda2.default.pick(['raw']), _ramda2.default.merge({
      lineNumber: line.current.number,
      assertionNumber: line.current.assertionNumber,
      diagnostic: {}
    }))(line);

    return formattedLine;
  }).merge(assertionsWithComments$).map(function (line) {
    return formatAssertionObject(line, currentTestNumber);
  });
}

function getPlans$(input$) {
  return input$.filter(isPlan).map(formatPlanObject);
}

function getVerions$(input$) {
  return input$.filter(isVersion).map(formatVersionObject);
}

function getGroupedLines$(input$) {
  return input$.pairwise().map(formatLinePair);
}

function getComments$(input$) {
  var parsingCommentBlock = false;
  var formattedLines$ = getGroupedLines$(input$);
  var commentBlockStart$ = getCommentBlockStart$(formattedLines$);
  var commentBlockEnd$ = getCommentBlockEnd$(formattedLines$);

  commentBlockStart$.forEach(function () {
    parsingCommentBlock = true;
  });
  commentBlockEnd$.forEach(function () {
    parsingCommentBlock = false;
  });

  return formattedLines$.filter(function (line) {
    var raw = line.current.raw;

    if (parsingCommentBlock) {
      return false;
    }

    if (isTest(raw)) {
      return false;
    }

    if (isResult(raw)) {
      return false;
    }

    if (isAssertion(raw)) {
      return false;
    }

    if (isVersion(raw)) {
      return false;
    }

    if (isCommentBlockStart(raw)) {
      return false;
    }

    if (isCommentBlockEnd(raw)) {
      return false;
    }

    if (isPlan(raw)) {
      return false;
    }

    if (isOk(raw)) {
      return false;
    }

    if (raw === '') {
      return false;
    }

    return true;
  }).map(formatCommentObject);
}

function getTests$(input$) {
  var formattedLines$ = getGroupedLines$(input$);
  return getFormattedTests$(formattedLines$);
}

function getAssertions$(input$) {
  var formattedLines$ = getGroupedLines$(input$);
  var tests$ = getTests$(input$);
  var assertions$ = getRawAssertions$(formattedLines$);
  var commentBlockStart$ = getCommentBlockStart$(formattedLines$);
  var commentBlockEnd$ = getCommentBlockEnd$(formattedLines$);
  var commentBlocks$ = getCommentBlocks$(formattedLines$, commentBlockStart$, commentBlockEnd$);

  return getFormattedAssertions$(assertions$, commentBlocks$, tests$);
}

function parse$(tap$) {
  var plans$ = getPlans$(tap$);
  var versions$ = getVerions$(tap$);
  var tests$ = getTests$(tap$);
  var assertions$ = getAssertions$(tap$);
  var comments$ = getComments$(tap$);
  var passingAssertions$ = assertions$.filter(function (a) {
    return a.ok;
  });
  var failingAssertions$ = assertions$.filter(function (a) {
    return !a.ok;
  });
  var results$ = O.merge(getResult$('tests', assertions$), getResult$('pass', passingAssertions$), getResult$('fail', failingAssertions$));
  var all$ = O.merge(tests$, assertions$, comments$, plans$, versions$, results$);

  all$.tests$ = tests$;
  all$.assertions$ = assertions$;
  all$.plans$ = plans$;
  all$.versions$ = versions$;
  all$.comments$ = comments$;
  all$.results$ = results$;
  all$.passingAssertions$ = passingAssertions$;
  all$.failingAssertions$ = failingAssertions$;

  return all$;
}

var stream = exports.stream = function stream() {
  var input = new _passthrough2.default();
  var output = new _passthrough2.default();
  var returnStream = (0, _duplexer2.default)(input, output);
  var tap$ = _rxNode2.default.fromStream(input.pipe((0, _split2.default)()));

  _rxNode2.default.writeToStream(parse$(tap$).map(JSON.stringify), output);

  return returnStream;
};

// TODO: not completely happy about this name for the method
var observeStream = exports.observeStream = function observeStream(_stream) {
  var input$ = _rxNode2.default.fromStream(_stream.pipe((0, _split2.default)()));
  return parse$(input$);
};