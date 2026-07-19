import { NextResponse } from 'next/server';

const rawBackendUrl = process.env.BACKEND_URL?.trim();
const backendUrl = rawBackendUrl && /^https?:\/\//i.test(rawBackendUrl)
  ? rawBackendUrl.replace(/\/+$/, '')
  : 'http://backend:3001';

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');

  const login = await fetch(`${backendUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    cache: 'no-store',
  }).catch(() => null);

  if (!login?.ok) {
    return new NextResponse(null, { status: 303, headers: { Location: '/login?loginError=1' } });
  }

  const response = new NextResponse(null, { status: 303, headers: { Location: '/dashboard' } });
  const sessionCookie = login.headers.get('set-cookie');
  if (sessionCookie) response.headers.set('set-cookie', sessionCookie);
  return response;
}
