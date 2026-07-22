import type { FleetAssistantResponse } from './fleet-assistant.provider';

const MAX_TITLE_LENGTH = 120;
const MAX_TEXT_LENGTH = 2_000;
const MAX_TABLE_ROWS = 12;
const MAX_LABEL_LENGTH = 100;
const MAX_VALUE_LENGTH = 300;

export const fleetAssistantResponseSchema = {
  type: 'json_schema' as const,
  name: 'fleet_assistant_response',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'text', 'table', 'action'],
    properties: {
      title: { type: 'string', minLength: 1, maxLength: MAX_TITLE_LENGTH },
      text: { type: 'string', minLength: 1, maxLength: MAX_TEXT_LENGTH },
      table: {
        type: 'array',
        maxItems: MAX_TABLE_ROWS,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['label', 'value'],
          properties: {
            label: { type: 'string', minLength: 1, maxLength: MAX_LABEL_LENGTH },
            value: { type: 'string', minLength: 1, maxLength: MAX_VALUE_LENGTH },
          },
        },
      },
      action: {
        anyOf: [
          { type: 'null' },
          {
            type: 'object',
            additionalProperties: false,
            required: ['label', 'href'],
            properties: {
              label: { type: 'string', minLength: 1, maxLength: MAX_LABEL_LENGTH },
              href: { type: 'string', minLength: 1, maxLength: 200 },
            },
          },
        ],
      },
    },
  },
};

export function validateFleetAssistantResponse(value: unknown): FleetAssistantResponse {
  if (!isRecord(value) || !onlyKeys(value, ['title', 'text', 'table', 'action'])) throw new Error('Assistant response has an invalid shape.');
  if (!isText(value.title, MAX_TITLE_LENGTH) || !isText(value.text, MAX_TEXT_LENGTH) || !Array.isArray(value.table) || value.table.length > MAX_TABLE_ROWS) throw new Error('Assistant response is invalid.');
  const table = value.table.map((row) => {
    if (!isRecord(row) || !onlyKeys(row, ['label', 'value']) || !isText(row.label, MAX_LABEL_LENGTH) || !isText(row.value, MAX_VALUE_LENGTH)) throw new Error('Assistant table is invalid.');
    return { label: row.label, value: row.value };
  });
  const action = value.action === null ? null : validAction(value.action);
  return { title: value.title, text: value.text, table, action };
}

function validAction(value: unknown): FleetAssistantResponse['action'] {
  if (!isRecord(value) || !onlyKeys(value, ['label', 'href']) || !isText(value.label, MAX_LABEL_LENGTH) || !isText(value.href, 200) || !isSafeInternalRoute(value.href)) throw new Error('Assistant action is invalid.');
  return { label: value.label, href: value.href };
}

function isSafeInternalRoute(href: string) { return href.startsWith('/') && !href.startsWith('//') && !/^[a-z][a-z0-9+.-]*:/i.test(href) && !href.includes('\\'); }
function isText(value: unknown, max: number): value is string { return typeof value === 'string' && value.trim().length > 0 && value.length <= max; }
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function onlyKeys(value: Record<string, unknown>, allowed: string[]) { return Object.keys(value).every((key) => allowed.includes(key)); }
