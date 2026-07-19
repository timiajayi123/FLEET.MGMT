'use client';

import { PageHeader } from '@/components/page-header';
import { VehicleRequestForm } from '@/app/vehicle-request-form';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function NewVehicleRequestPage() {
  const router = useRouter();
  const [checkingRole, setCheckingRole] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        const roleCode = payload?.user?.role?.code;
        if (roleCode === 'S_ADMIN' || roleCode === 'FM') {
          router.replace('/fleet/vehicle-requests/review');
          return;
        }
        setCheckingRole(false);
      })
      .catch(() => setCheckingRole(false));
  }, [router]);

  if (checkingRole) {
    return (
      <>
        <PageHeader
          title="Vehicle Request"
          description="Checking your access to the vehicle request workflow."
        />
        <section className="master-panel">
          <p>Loading vehicle request workflow…</p>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="New Vehicle Request"
        description="Submit an official transport request for admin review and approval."
      />
      <VehicleRequestForm embedded />
    </>
  );
}
