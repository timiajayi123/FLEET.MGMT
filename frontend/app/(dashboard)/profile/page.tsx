'use client';

import { PageHeader } from '@/components/page-header';
import {
  BadgeCheck,
  Building2,
  Camera,
  IdCard,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import Image from 'next/image';
import { FormEvent, useEffect, useState } from 'react';

type User = {
  id: string;
  staffName: string;
  employeeId: string;
  email: string;
  phone?: string | null;
  status: string;
  passportMimeType?: string | null;
  createdAt: string;
  role: { name: string; code: string };
  department?: { name: string; code: string } | null;
  directorate?: { name: string; code: string } | null;
  location?: { name: string; code: string } | null;
};

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageVersion, setImageVersion] = useState(0);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || 'Unable to load profile.');
        setUser(payload.user);
      })
      .catch((reason) => {
        setIsError(true);
        setMessage(reason instanceof Error ? reason.message : 'Unable to load profile.');
      });
  }, []);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    const form = event.currentTarget;
    setUploading(true);
    setMessage('');
    setIsError(false);
    try {
      const response = await fetch(`/api/users/${user.id}/passport`, {
        method: 'POST',
        body: new FormData(form),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Photograph upload failed.');
      setUser({ ...user, passportMimeType: 'image' });
      setImageVersion((version) => version + 1);
      setMessage('Profile photograph updated successfully.');
      form.reset();
    } catch (reason) {
      setIsError(true);
      setMessage(reason instanceof Error ? reason.message : 'Photograph upload failed.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <PageHeader
        title="My Profile"
        description="Review your staff identity, work assignment and profile photograph."
      />
      <section className="profile-page">
        <article className="profile-identity-card">
          <div className="profile-cover" />
          <div className="profile-identity-body">
            <div className="profile-photo-wrap">
              {user?.passportMimeType ? (
                <Image
                  unoptimized
                  width={128}
                  height={128}
                  className="profile-photo"
                  src={`/api/users/${user.id}/passport?v=${imageVersion}`}
                  alt={`${user.staffName} profile photograph`}
                />
              ) : (
                <span className="profile-photo profile-photo-placeholder">
                  {user?.staffName?.slice(0, 2).toUpperCase() || <UserRound size={40} />}
                </span>
              )}
              <span className="profile-photo-badge">
                <Camera size={15} />
              </span>
            </div>
            <div className="profile-name-block">
              <small>STAFF PROFILE</small>
              <h2>{user?.staffName || 'Loading profile…'}</h2>
              <p>{user?.role.name || 'Retrieving role information'}</p>
              {user && (
                <span className="profile-status">
                  <BadgeCheck size={14} /> {user.status}
                </span>
              )}
            </div>
          </div>
          <form className="profile-photo-form" onSubmit={upload}>
            <label>
              <span>Change profile photograph</span>
              <input
                name="passport"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required
              />
              <small>JPEG, PNG or WebP, up to 3 MB.</small>
            </label>
            <button className="primary-action" disabled={!user || uploading}>
              <Camera size={16} /> {uploading ? 'Uploading…' : 'Upload photograph'}
            </button>
          </form>
        </article>

        <div className="profile-information">
          <article className="profile-detail-card">
            <header>
              <UserRound size={19} />
              <div>
                <h3>Personal information</h3>
                <p>Your registered contact and staff details.</p>
              </div>
            </header>
            <dl className="profile-detail-list">
              <ProfileFact icon={IdCard} label="Employee ID" value={user?.employeeId} />
              <ProfileFact icon={Mail} label="Email address" value={user?.email} />
              <ProfileFact
                icon={Phone}
                label="Phone number"
                value={user?.phone || 'Not provided'}
              />
              <ProfileFact icon={ShieldCheck} label="System role" value={user?.role.name} />
            </dl>
          </article>

          <article className="profile-detail-card">
            <header>
              <Building2 size={19} />
              <div>
                <h3>Work assignment</h3>
                <p>Your organisational placement and office location.</p>
              </div>
            </header>
            <dl className="profile-detail-list">
              <ProfileFact
                icon={Building2}
                label="Directorate"
                value={user?.directorate?.name || 'Not assigned'}
              />
              <ProfileFact
                icon={Building2}
                label="Department"
                value={user?.department?.name || 'Not assigned'}
              />
              <ProfileFact
                icon={MapPin}
                label="Location"
                value={user?.location?.name || 'Not assigned'}
              />
              <ProfileFact
                icon={BadgeCheck}
                label="Member since"
                value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : undefined}
              />
            </dl>
          </article>
        </div>
      </section>
      {message && (
        <div className={`profile-message ${isError ? 'error' : 'success'}`}>{message}</div>
      )}
    </>
  );
}

function ProfileFact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UserRound;
  label: string;
  value?: string;
}) {
  return (
    <div>
      <Icon size={17} />
      <span>
        <dt>{label}</dt>
        <dd>{value || 'Loading…'}</dd>
      </span>
    </div>
  );
}
