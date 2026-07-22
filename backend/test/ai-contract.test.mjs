import assert from 'node:assert/strict';
import test from 'node:test';
import { validateFleetAssistantResponse } from '../dist/src/ai/fleet-assistant.contract.js';
import { AiService } from '../dist/src/ai/ai.service.js';
import { AiRateLimitService } from '../dist/src/ai/ai-rate-limit.service.js';
import { AiController } from '../dist/src/ai/ai.controller.js';
import { BuiltinFleetAssistantProvider } from '../dist/src/ai/builtin-fleet-assistant.provider.js';

const response = { title: 'Fleet summary', text: 'Two trips were completed.', table: [{ label: 'Completed trips', value: '2' }], action: { label: 'Open reports', href: '/analytics/reports' } };
const context = { requestId: 'test-request', userId: 'test-user', role: 'FM' };

test('accepts the preserved assistant response contract', () => {
  assert.deepEqual(validateFleetAssistantResponse(response), response);
});

test('rejects unsafe action URLs and unknown response fields', () => {
  assert.throws(() => validateFleetAssistantResponse({ ...response, action: { label: 'Unsafe', href: 'javascript:alert(1)' } }));
  assert.throws(() => validateFleetAssistantResponse({ ...response, unknown: true }));
});

test('always uses the built-in assistant', async () => {
  const builtin = { ask: async () => response };
  const service = new AiService(builtin);
  assert.deepEqual(await service.ask('summary', context), response);
});

test('answers fleet questions only from trusted analytics services', async () => {
  const assistant = new BuiltinFleetAssistantProvider(fakeAnalytics(), { trip: { findFirst: async () => null }, vehicleRequest: { findMany: async () => [] } });
  const drivers = await assistant.ask('How many drivers are registered?', context);
  const pending = await assistant.ask('Show pending vehicle requests', context);
  const speed = await assistant.ask('Show overspeed events', context);
  assert.equal(drivers.title, 'Driver count');
  assert.equal(pending.title, 'Pending vehicle requests');
  assert.equal(speed.title, 'Driver speed events');
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

function fakeAnalytics() {
  return {
    dashboard: async () => ({ metrics: { vehicles: 3, availableVehicles: 2, inUseVehicles: 1, maintenanceVehicles: 0, drivers: 4, activeDrivers: 2, requests: 5, pendingRequests: 1, approvedRequests: 2, trips: 4, activeTrips: 1, completedTrips: 3, distanceTravelled: 12.4 }, requestStatus: [{ label: 'COMPLETED', value: 3 }], tripPurpose: [{ label: 'Official', value: 4 }], mostUsedVehicles: [{ label: 'FLEET-01', value: 3 }], mostActiveDrivers: [{ label: 'Driver 1', value: 3 }] }),
    speed: async (_filters, threshold) => ({ threshold, records: 3, violations: [], averageSpeed: 30, maximumSpeed: 50 }),
  };
}

function controllerFor(role) { return new AiController({ fromToken: async () => ({ id: `user-${role}`, role: { code: role } }) }, { ask: async () => response }, new AiRateLimitService()); }
function request() { return { headers: { cookie: 'fleet_session=test' } }; }
