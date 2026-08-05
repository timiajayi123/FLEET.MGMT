import assert from 'node:assert/strict';
import test from 'node:test';
import { speedSeverity } from '../dist/src/speed/speed-limits.service.js';

const settings = { lowSeverityMaxExcess: 10, mediumSeverityMaxExcess: 20, highSeverityMaxExcess: 40 };

test('classifies overspeed severity at configured boundaries', () => {
  assert.equal(speedSeverity(1, settings), 'LOW');
  assert.equal(speedSeverity(10, settings), 'LOW');
  assert.equal(speedSeverity(10.1, settings), 'MEDIUM');
  assert.equal(speedSeverity(20.1, settings), 'HIGH');
  assert.equal(speedSeverity(40.1, settings), 'CRITICAL');
});

test('speed module exposes the required operational routes', async () => {
  const source = await import('node:fs/promises').then((fs) => fs.readFile(new URL('../src/speed/speed.controller.ts', import.meta.url), 'utf8'));
  for (const route of ['dashboard', 'live', 'violations', 'reports', 'settings', 'vehicle-types']) assert.match(source, new RegExp(`['"]${route}`));
});
