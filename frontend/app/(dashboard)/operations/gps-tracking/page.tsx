'use client';

import { DriverTripDashboard } from '@/components/driver-trip-dashboard';
import { LiveFleetMap } from '@/components/live-fleet-map';
import { PageHeader } from '@/components/page-header';
import { RadioTower } from 'lucide-react';
import { useEffect, useState } from 'react';

type User = { staffName: string; role: { code: string; name: string } };

export default function GpsTrackingPage() {
  const [user,setUser]=useState<User|null>(null),[loaded,setLoaded]=useState(false);
  useEffect(()=>{fetch('/api/auth/me',{cache:'no-store'}).then((response)=>response.ok?response.json():null).then((payload)=>setUser(payload?.user??null)).finally(()=>setLoaded(true));},[]);
  if(!loaded)return <div className="driver-dashboard-skeleton"><span/><span/><span/></div>;
  if(user?.role.code==='DRIVER')return <><PageHeader title="Driver Trip & GPS" description="Manage your assigned trip and share location only while the trip is active."/><DriverTripDashboard/></>;
  return <><PageHeader title="Live Fleet Map" description="Real-time vehicle movement, driver assignments, trip status and route visibility." actions={<span className="date-chip"><RadioTower size={15}/> Live operations</span>}/><LiveFleetMap/></>;
}
