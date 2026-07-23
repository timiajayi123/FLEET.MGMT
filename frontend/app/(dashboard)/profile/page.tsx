'use client';

import { PageHeader } from '@/components/page-header';
import Image from 'next/image';
import { FormEvent, useEffect, useState } from 'react';

type User = { id: string; staffName: string; employeeId: string; email: string; phone?: string; passportMimeType?: string; role: { name: string } };

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null), [message, setMessage] = useState(''), [imageVersion, setImageVersion] = useState(0);
  useEffect(() => { fetch('/api/auth/me').then((response) => response.json()).then((payload) => setUser(payload.user)).catch(() => setMessage('Unable to load profile.')); }, []);
  async function upload(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!user) return; const response = await fetch(`/api/users/${user.id}/passport`, { method: 'POST', body: new FormData(event.currentTarget) }); if (!response.ok) { const payload = await response.json().catch(() => ({})); setMessage(payload.message || 'Upload failed.'); return; } setUser({ ...user, passportMimeType: 'image' }); setImageVersion((version) => version + 1); setMessage('Passport photograph updated.'); }
  return <><PageHeader title="My profile" description="Your staff identity and passport photograph."/><section className="master-panel"><div className="profile-summary">{user?.passportMimeType ? <Image unoptimized width={96} height={96} className="avatar" src={`/api/users/${user.id}/passport?v=${imageVersion}`} alt={`${user.staffName} passport`}/> : <span className="avatar">{user?.staffName?.slice(0, 2).toUpperCase() || 'â€”'}</span>}<span><strong>{user?.staffName || 'Loadingâ€¦'}</strong><small>{user?.email}</small></span></div>{user && <dl className="details-grid"><div><dt>Employee ID</dt><dd>{user.employeeId}</dd></div><div><dt>Role</dt><dd>{user.role.name}</dd></div><div><dt>Phone</dt><dd>{user.phone || 'â€”'}</dd></div></dl>}<form onSubmit={upload} className="master-form-grid"><label className="master-field full"><span>Passport photograph</span><input name="passport" type="file" accept="image/jpeg,image/png,image/webp" required/><small>JPEG, PNG, or WebP; maximum 3 MB.</small></label><button className="primary-action">Upload photograph</button></form>{message && <p className="alert success">{message}</p>}</section></>;
}
