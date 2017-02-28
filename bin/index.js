#!/usr/bin/env node

const parser = require('../lib/parser');
const formatAsSpec = require('../');

const input = parser.observeStream(process.stdin);

formatAsSpec(input).forEach(console.log.bind(console));
