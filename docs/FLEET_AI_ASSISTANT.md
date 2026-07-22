# Fleet AI Assistant

## Modes

The assistant keeps the existing built-in analytics mode as the default. It uses fixed, server-side analytics queries and does not contact an external AI provider.

OpenAI mode is enabled only when the backend process has `AI_PROVIDER=openai` and a backend-only `AI_API_KEY`. `AI_MODEL` is optional and defaults to `gpt-5.6-terra`. Do not put any of these values in frontend code or commit a real key.

If OpenAI configuration is missing or an OpenAI request fails, the backend returns the built-in assistant result instead.

## Provider architecture

`POST /api/ai/assistant` keeps its current request and response contract. The controller authenticates the session and permits only `S_ADMIN` and `FM`, then applies a per-user rate limit. The provider router selects either the built-in provider or the server-only OpenAI Responses API provider.

The OpenAI provider uses the Responses API with Structured Outputs. It has a short timeout, retries only temporary 429/5xx provider errors, and logs safe operational metadata only. It does not log API keys, cookies, prompts, or raw fleet records.

## Approved read-only tools

- `get_fleet_summary`
- `get_pending_vehicle_requests`
- `get_latest_trip`
- `get_vehicle_utilisation`
- `get_driver_activity`
- `get_speed_violations`
- `get_request_report_summary`

Tools use existing backend analytics services. They are read-only, have strict schemas, reject unknown arguments, and never expose Prisma, raw SQL, shell access, file access, URLs, approval actions, allocations, or database write actions.

## Privacy and safety

The provider sends only the user question and the minimum aggregate tool output needed for an answer. Phone numbers, email addresses, session information, authentication data, and unnecessary destination or staff details are not sent. The model is instructed to use only returned tool data and cannot approve requests, assign vehicles, or change records.

## Local setup

Keep secrets in the uncommitted `backend/.env` file. Use built-in mode by leaving `AI_PROVIDER` unset or setting it to `builtin`. To enable OpenAI mode locally, set the backend-only provider name and API key in that local file, then restart the backend. Do not use a frontend environment variable for an AI key.

## Testing and rollback

Run:

```powershell
npm run lint -w backend
npm run build -w backend
npm run test -w backend
```

To roll back immediately, set `AI_PROVIDER=builtin` or remove the OpenAI provider setting, then restart the backend. The original endpoint and frontend remain unchanged.
