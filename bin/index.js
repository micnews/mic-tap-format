#!/usr/bin/env node

const parser = require('../dist/lib/parser');
const formatAsSpec = require('../dist/').default;

const input = parser.observeStream(process.stdin);

formatAsSpec(input).forEach(console.log.bind(console));
