# Fleet AI Assistant

The Fleet AI Assistant is a built-in, deterministic fleet analytics guide. It does not contact an external AI service, use API keys, generate SQL, or perform write actions.

## Contract and access

`POST /api/ai/assistant` accepts `{ "message": "string" }` and returns `{ "data": { "title", "text", "table", "action" } }`.

Only `S_ADMIN` and `FM` users can call the route. Requests are rate limited per user. The backend validates the response shape and allows actions only to safe internal routes.

## Trusted answers

The assistant uses predefined, read-only server queries for:

- fleet summaries and vehicle availability
- pending vehicle requests
- latest request-backed trip
- vehicle utilisation and active drivers
- recorded speed-limit events
- trip-purpose and department summaries
- report navigation

It never executes model-generated SQL, shell commands, external links, approvals, vehicle allocations, or other write operations.

## Validation

```powershell
npm run lint -w backend
npm run build -w backend
npm run test -w backend
```
