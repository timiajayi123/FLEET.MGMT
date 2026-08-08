import { AppShell } from '@/components/app-shell';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  if (!cookieStore.has('fleet_session')) redirect('/login');

  return <AppShell>{children}</AppShell>;
}
