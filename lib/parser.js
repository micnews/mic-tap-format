

const Rx = require('rx');
const RxNode = require('rx-node');
const R = require('ramda');
const PassThrough = require('readable-stream/passthrough');
const split = require('split');
const duplexer = require('duplexer');
const jsYaml = require('js-yaml');

const O = Rx.Observable;

const TEST = 'TEST';
const ASSERTION = 'ASSERTION';
const PLAN = 'PLAN';
const VERSION = 'VERSION';
const COMMENT_BLOCK_START = 'COMMENT_BLOCK_START';
const COMMENT_BLOCK_END = 'COMMENT_BLOCK_END';
const COMMENT = 'COMMENT';
const RESULT = 'RESULT';
const TODO = 'TODO';

const COMMENT_BLOCK_PADDING_SIZE = 2;

const REGEXES = {
  test: /^#\s+(.+)/,
  assertion: new RegExp('^(not )?ok\\b(?:(?:\\s+(\\d+))?(?:\\s+(?:(?:\\s*-\\s*)?(.*)))?)?'),
  result: /^# (fail|tests|pass)\s+[0-9]+/,
  plan: /^(\d+)\.\.(\d+)\b(?:\s+#\s+SKIP\s+(.*)$)?/,
  version: /^TAP\s+version\s+(\d+)/i,
  todo: /^(.*?)\s*#\s*TODO\s+(.*)$/,
  skip: /^(.*?)\s*#\s*SKIP\s+(.*)$/,
};

const removeCommentBlockPadding = R.map(R.drop(COMMENT_BLOCK_PADDING_SIZE));
const parseYamlBlock = R.pipe(
  removeCommentBlockPadding,
  R.join('\n'),
  jsYaml.safeLoad,
);

module.exports = {
  stream() {
    const input = new PassThrough();
    const output = new PassThrough();
    const returnStream = duplexer(input, output);
    const tap$ = RxNode.fromStream(input.pipe(split()));

    RxNode.writeToStream(parse$(tap$).map(JSON.stringify), output);

    return returnStream;
  },

  // TODO: not completely happy about this name for the method
  observeStream(stream) {
    const input$ = RxNode.fromStream(stream.pipe(split()));
    return parse$(input$);
  },
};

function parse$(tap$) {
  const plans$ = getPlans$(tap$);
  const versions$ = getVerions$(tap$);
  const tests$ = getTests$(tap$);
  const assertions$ = getAssertions$(tap$);
  const comments$ = getComments$(tap$);
  const passingAssertions$ = assertions$.filter(a => a.ok);
  const failingAssertions$ = assertions$.filter(a => !a.ok);
  const results$ = O.merge(
    getResult$('tests', assertions$),
    getResult$('pass', passingAssertions$),
    getResult$('fail', failingAssertions$),
  );
  const all$ = O
    .merge(
      tests$,
      assertions$,
      comments$,
      plans$,
      versions$,
      results$,
    );

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

function getResult$(name, input$) {
  return input$
    .scan(prev => prev + 1, 0)
    .last()
    .map(count => ({
      type: 'result',
      name,
      count,
      raw: `# ${name} ${count}`,
    }));
}

function getAssertions$(input$) {
  const formattedLines$ = getGroupedLines$(input$);
  const tests$ = getTests$(input$);
  const assertions$ = getRawAssertions$(formattedLines$);
  const commentBlockStart$ = getCommentBlockStart$(formattedLines$);
  const commentBlockEnd$ = getCommentBlockEnd$(formattedLines$);
  const commentBlocks$ = getCommentBlocks$(formattedLines$, commentBlockStart$, commentBlockEnd$);

  return getFormattedAssertions$(assertions$, commentBlocks$, tests$);
}

function getTests$(input$) {
  const formattedLines$ = getGroupedLines$(input$);
  return getFormattedTests$(formattedLines$);
}

function getComments$(input$) {
  let parsingCommentBlock = false;
  const formattedLines$ = getGroupedLines$(input$);
  const commentBlockStart$ = getCommentBlockStart$(formattedLines$);
  const commentBlockEnd$ = getCommentBlockEnd$(formattedLines$);

  commentBlockStart$.forEach(() => { parsingCommentBlock = true; });
  commentBlockEnd$.forEach(() => { parsingCommentBlock = false; });

  return formattedLines$
    .filter((line) => {
      const raw = line.current.raw;

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
    })
    .map(formatCommentObject);
}

function getPlans$(input$) {
  return input$
    .filter(isPlan)
    .map(formatPlanObject);
}

function getVerions$(input$) {
  return input$
    .filter(isVersion)
    .map(formatVersionObject);
}

function getGroupedLines$(input$) {
  return input$
    .pairwise()
    .map(formatLinePair);
}

function getRawAssertions$(input$) {
  return input$
    .filter(R.pipe(
      R.path(['current', 'type']),
      R.equals(ASSERTION),
    ))
    .map((line, index) => {
      line.current.assertionNumber = index + 1;
      line.next.assertionNumber = index + 2;
      return line;
    });
}

function getCommentBlockStart$(input$) {
  return input$
    .filter(R.pipe(
      R.path(['current', 'type']),
      R.equals(COMMENT_BLOCK_START),
    ));
}

function getCommentBlockEnd$(input$) {
  return input$
    .filter(R.pipe(
      R.path(['current', 'type']),
      R.equals(COMMENT_BLOCK_END),
    ));
}

function getAssertionsWithComments(assertions$, blocks$) {
  return assertions$
    .filter(R.pipe(
      R.path(['next', 'type']),
      R.equals(COMMENT_BLOCK_START),
    ))
    .flatMap(line => blocks$.take(1)
        .map(rawDiagnostic => ({
          raw: line.current.raw,
          lineNumber: line.current.number,
          assertionNumber: line.current.assertionNumber,
          diagnostic: parseYamlBlock(rawDiagnostic),
          rawDiagnostic,
        })));
}

function getCommentBlocks$(formattedLines$, start$, end$) {
  let parsingCommentBlock = false;
  let currentCommentBlock = [];
  const formatBlock = R.pipe(
    R.map(R.path(['current', 'raw'])),
    R.flatten,
  );

  formattedLines$
    .forEach((line) => {
      if (parsingCommentBlock) {
        currentCommentBlock.push(line);
      } else {
        currentCommentBlock = [];
      }
    });

  start$
    .forEach((line) => {
      currentCommentBlock = [line];
      parsingCommentBlock = true;
    });

  return end$
    .map(() => {
      parsingCommentBlock = false;
      return formatBlock(currentCommentBlock);
    });
}

function getFormattedTests$(input$) {
  return input$
    .filter(R.pipe(
      R.path(['current', 'type']),
      R.equals(TEST),
    ))
    .map((line, index) => formatTestObject(line.current.raw, line.current.number, index + 1));
}

function getFormattedAssertions$(assertions$, commentBlocks$, tests$) {
  let currentTestNumber = 0;
  const assertionsWithComments$ = getAssertionsWithComments(assertions$, commentBlocks$);

  tests$.forEach((line) => { currentTestNumber = line.testNumber; });

  return assertions$
    .filter(R.pipe(
      R.path(['next', 'type']),
      R.complement(R.equals(COMMENT_BLOCK_START)),
    ))
    .map((line) => {
      const formattedLine = R.pipe(
        R.path(['current']),
        R.pick(['raw']),
        R.merge({
          lineNumber: line.current.number,
          assertionNumber: line.current.assertionNumber,
          diagnostic: {},
        }),
      )(line);

      return formattedLine;
    })
    .merge(assertionsWithComments$)
    .map(line => formatAssertionObject(line, currentTestNumber));
}

function formatLinePair(pair, index) {
  return {
    current: {
      raw: pair[0],
      type: getLineType(pair[0]),
      number: index,
    },
    next: {
      raw: pair[1],
      type: getLineType(pair[1]),
      number: index + 1,
    },
  };
}

function isTest(line) {
  return REGEXES.test.test(line)
    && !isResult(line)
    && !isOk(line);
}

function isOk(line) {
  return line === '# ok';
}

function isResult(line) {
  return REGEXES.result.test(line);
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
}

function formatCommentObject(line) {
  const raw = line.current.raw;

  return {
    raw,
    title: raw,
    lineNumber: line.current.number,
    type: 'comment',
  };
}

function formatTestObject(line, lineNumber, testNumber) {
  return {
    raw: line,
    type: 'test',
    title: line.replace('# ', ''),
    lineNumber,
    testNumber,
  };
}

function formatAssertionObject(line, testNumber) {
  const m = REGEXES.assertion.exec(line.raw);
  const rawDiagnostic = '';

  if (line.rawDiagnostic) {
    rawDiagnostic = line.rawDiagnostic.join('\n');
  }

  return {
    type: 'assertion',
    title: m[3],
    raw: `${line.raw}\n${rawDiagnostic}`,
    ok: !m[1],
    diagnostic: line.diagnostic, // TODO: rename this to "diagnostic",
    rawDiagnostic,
    lineNumber: line.lineNumber,
    testNumber,
    assertionNumber: line.assertionNumber,
  };
}

function formatPlanObject(line) {
  const m = REGEXES.plan.exec(line);

  return {
    type: 'plan',
    raw: line,
    from: m[1] && Number(m[1]),
    to: m[2] && Number(m[2]),
    skip: m[3],
  };
}

function formatVersionObject(line) {
  return {
    raw: line,
    type: 'version',
  };
}
