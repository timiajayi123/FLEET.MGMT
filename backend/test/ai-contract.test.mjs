import assert from 'node:assert/strict';
import test from 'node:test';
import { validateFleetAssistantResponse } from '../dist/src/ai/fleet-assistant.contract.js';
import { AiService } from '../dist/src/ai/ai.service.js';
import { AiRateLimitService } from '../dist/src/ai/ai-rate-limit.service.js';
import { OpenAiFleetAssistantProvider } from '../dist/src/ai/openai-fleet-assistant.provider.js';
import { AiController } from '../dist/src/ai/ai.controller.js';

const response = { title: 'Fleet summary', text: 'Two trips were completed.', table: [{ label: 'Completed trips', value: '2' }], action: { label: 'Open reports', href: '/analytics/reports' } };
const context = { requestId: 'test-request', userId: 'test-user', role: 'FM' };

test('accepts the preserved assistant response contract', () => {
  assert.deepEqual(validateFleetAssistantResponse(response), response);
});

test('rejects unsafe action URLs and unknown response fields', () => {
  assert.throws(() => validateFleetAssistantResponse({ ...response, action: { label: 'Unsafe', href: 'javascript:alert(1)' } }));
  assert.throws(() => validateFleetAssistantResponse({ ...response, unknown: true }));
});

test('uses the built-in provider by default', async () => {
  const builtin = { ask: async () => response };
  const openai = { isAvailable: () => true, ask: async () => ({ ...response, title: 'OpenAI' }) };
  const service = new AiService(builtin, openai);
  const previous = process.env.AI_PROVIDER;
  delete process.env.AI_PROVIDER;
  assert.equal((await service.ask('summary', context)).title, 'Fleet summary');
  process.env.AI_PROVIDER = previous;
});

test('falls back to built-in mode when OpenAI is missing configuration', async () => {
  const builtin = { ask: async () => response };
  const openai = { isAvailable: () => false, ask: async () => { throw new Error('must not run'); } };
  const service = new AiService(builtin, openai);
  const previous = process.env.AI_PROVIDER;
  process.env.AI_PROVIDER = 'openai';
  assert.equal((await service.ask('summary', context)).title, 'Fleet summary');
  process.env.AI_PROVIDER = previous;
});

test('enforces a per-user assistant request limit', () => {
  const limiter = new AiRateLimitService();
  for (let index = 0; index < 12; index += 1) limiter.check('rate-test-user');
  assert.throws(() => limiter.check('rate-test-user'));
});

test('allows S_ADMIN and FM, while staff and drivers are blocked before assistant execution', async () => {
  for (const role of ['S_ADMIN', 'FM']) {
    const controller = controllerFor(role);
    assert.equal((await controller.ask(request(), { message: 'summary' })).data.title, 'Fleet summary');
  }
  for (const role of ['STAFF', 'DRIVER']) {
    const controller = controllerFor(role);
    await assert.rejects(() => controller.ask(request(), { message: 'summary' }), { status: 403 });
  }
});

test('uses only approved read-only tools with mocked OpenAI Responses API output', async () => {
  const analytics = fakeAnalytics();
  const provider = new OpenAiFleetAssistantProvider(analytics);
  const previousProvider = process.env.AI_PROVIDER;
  const previousKey = process.env.AI_API_KEY;
  process.env.AI_PROVIDER = 'openai';
  process.env.AI_API_KEY = 'test-key-not-a-real-secret';
  let calls = 0;
  provider.client = { responses: { create: async () => {
    calls += 1;
    if (calls === 1) return { id: 'response-1', output: [{ type: 'function_call', name: 'get_fleet_summary', arguments: '{}', call_id: 'tool-1' }] };
    return { id: 'response-2', output: [], output_text: JSON.stringify(response) };
  } } };
  assert.deepEqual(await provider.ask('Give me a summary', context), response);
  assert.equal(calls, 2);
  process.env.AI_PROVIDER = previousProvider;
  process.env.AI_API_KEY = previousKey;
});

test('rejects unknown tools, raw SQL, write attempts, and invalid tool arguments', async () => {
  const provider = new OpenAiFleetAssistantProvider(fakeAnalytics());
  for (const call of [
    { name: 'run_sql', arguments: '{"sql":"SELECT * FROM users"}' },
    { name: 'approve_request', arguments: '{}' },
    { name: 'get_fleet_summary', arguments: '{"vehicleId":"unexpected"}' },
    { name: 'get_speed_violations', arguments: '{"threshold":999}' },
  ]) await assert.rejects(() => provider.runTool({ ...call, type: 'function_call', call_id: 'blocked' }, context));
});

test('rejects malformed structured OpenAI output', async () => {
  const provider = new OpenAiFleetAssistantProvider(fakeAnalytics());
  const previousProvider = process.env.AI_PROVIDER;
  const previousKey = process.env.AI_API_KEY;
  process.env.AI_PROVIDER = 'openai';
  process.env.AI_API_KEY = 'test-key-not-a-real-secret';
  provider.client = { responses: { create: async () => ({ id: 'bad', output: [], output_text: '{"title":"bad"}' }) } };
  await assert.rejects(() => provider.ask('summary', context));
  process.env.AI_PROVIDER = previousProvider;
  process.env.AI_API_KEY = previousKey;
});

test('retries temporary 429 errors and stops after the configured retry limit', async () => {
  const provider = new OpenAiFleetAssistantProvider(fakeAnalytics());
  const previousProvider = process.env.AI_PROVIDER;
  const previousKey = process.env.AI_API_KEY;
  process.env.AI_PROVIDER = 'openai';
  process.env.AI_API_KEY = 'test-key-not-a-real-secret';
  let calls = 0;
  provider.client = { responses: { create: async () => { calls += 1; const error = new Error('rate limited'); error.status = 429; throw error; } } };
  await assert.rejects(() => provider.ask('summary', context));
  assert.equal(calls, 3);
  process.env.AI_PROVIDER = previousProvider;
  process.env.AI_API_KEY = previousKey;
});

function fakeAnalytics() {
  return {
    dashboard: async () => ({ metrics: { vehicles: 3, availableVehicles: 2, inUseVehicles: 1, maintenanceVehicles: 0, requests: 5, pendingRequests: 1, approvedRequests: 2, activeTrips: 1, completedTrips: 3, distanceTravelled: 12.4 }, requestStatus: [{ label: 'COMPLETED', value: 3 }], tripPurpose: [{ label: 'Official', value: 4 }], mostUsedVehicles: [{ label: 'FLEET-01', value: 3 }], mostActiveDrivers: [{ label: 'Driver 1', value: 3 }] }),
    speed: async (_filters, threshold) => ({ threshold, records: 3, violations: [], averageSpeed: 30, maximumSpeed: 50 }),
    latestTripSummary: async () => ({ available: false }),
  };
}

function controllerFor(role) {
  return new AiController({ fromToken: async () => ({ id: `user-${role}`, role: { code: role } }) }, { ask: async () => response }, new AiRateLimitService());
}
function request() { return { headers: { cookie: 'fleet_session=test' } }; }
