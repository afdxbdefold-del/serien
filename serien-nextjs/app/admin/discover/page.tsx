import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function DiscoverDashboardRedirect() {
  redirect('/admin/discover-analytics');
}
