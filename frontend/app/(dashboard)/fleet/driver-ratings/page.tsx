'use client';

import { PageHeader } from '@/components/page-header';
import { MessageSquareText, Search, Star, Users } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

type RatingData = {
  metrics: {
    totalDrivers: number;
    ratedDrivers: number;
    totalRatings: number;
    averageRating: number | null;
  };
  drivers: Array<{
    id: string;
    staffName: string;
    employeeId: string;
    status: string;
    locationText?: string | null;
    location?: { name: string } | null;
    rating: number | null;
    ratingCount: number;
  }>;
  recentRatings: Array<{
    id: string;
    stars: number;
    likedTrip: boolean;
    remark?: string | null;
    createdAt: string;
    driver: { id: string; staffName: string; employeeId: string };
    ratedBy: { staffName: string };
    request: { requestNumber: string; destination: string };
    trip: { vehicle: { registrationNumber: string } };
  }>;
};

export default function DriverRatingsPage() {
  const [data, setData] = useState<RatingData | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/driver-ratings', { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || 'Unable to load driver ratings.');
        return payload.data as RatingData;
      })
      .then(setData)
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : 'Unable to load driver ratings.'),
      );
  }, []);

  const drivers = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    if (!term) return data?.drivers ?? [];
    return (data?.drivers ?? []).filter((driver) =>
      [driver.staffName, driver.employeeId, driver.location?.name, driver.locationText]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase().includes(term)),
    );
  }, [data?.drivers, query]);

  return (
    <>
      <PageHeader
        title="Driver Ratings"
        description="Review driver journey ratings and optional staff remarks after completed trips."
      />
      {error && <div className="master-alert">{error}</div>}
      {!data && !error && (
        <section className="master-panel">
          <div className="master-loading"><span /><span /><span /></div>
        </section>
      )}
      {data && (
        <div className="driver-ratings-workspace">
          <section className="driver-ratings-kpis">
            <RatingKpi icon={<Users size={19} />} label="Total drivers" value={data.metrics.totalDrivers} />
            <RatingKpi icon={<Star size={19} />} label="Rated drivers" value={data.metrics.ratedDrivers} />
            <RatingKpi icon={<MessageSquareText size={19} />} label="Total ratings" value={data.metrics.totalRatings} />
            <RatingKpi
              icon={<Star size={19} />}
              label="Fleet average"
              value={data.metrics.averageRating == null ? 'No ratings' : `${data.metrics.averageRating.toFixed(1)} / 5`}
            />
          </section>

          <section className="master-panel driver-ratings-panel">
            <div className="panel-heading">
              <div><h2>Driver rating summary</h2><p>Average journey rating and review count for every driver.</p></div>
              <label className="master-search">
                <Search size={16} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search driver, ID or location" />
              </label>
            </div>
            <div className="master-table-wrap">
              <table className="master-table driver-ratings-table">
                <thead><tr><th>Driver</th><th>Driver Rating</th><th>Reviews</th><th>Location</th><th>Status</th></tr></thead>
                <tbody>
                  {drivers.map((driver) => (
                    <tr key={driver.id}>
                      <td><strong>{driver.staffName}</strong><small>{driver.employeeId}</small></td>
                      <td><RatingValue value={driver.rating} /></td>
                      <td>{driver.ratingCount}</td>
                      <td>{driver.location?.name || driver.locationText || '—'}</td>
                      <td>{driver.status.replaceAll('_', ' ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!drivers.length && <div className="master-empty"><Star size={28} /><h3>No matching drivers</h3><p>Try another search.</p></div>}
            </div>
          </section>

          <section className="master-panel driver-ratings-panel">
            <div className="panel-heading"><div><h2>Recent journey feedback</h2><p>Latest ratings and optional remarks submitted by staff.</p></div></div>
            <div className="master-table-wrap">
              <table className="master-table driver-rating-feedback-table">
                <thead><tr><th>Driver</th><th>Rating</th><th>Experience</th><th>Remark</th><th>Trip</th><th>Rated by</th><th>Date</th></tr></thead>
                <tbody>
                  {data.recentRatings.map((rating) => (
                    <tr key={rating.id}>
                      <td><strong>{rating.driver.staffName}</strong><small>{rating.driver.employeeId}</small></td>
                      <td><RatingValue value={rating.stars} /></td>
                      <td><span className={rating.likedTrip ? 'rating-positive' : 'rating-negative'}>{rating.likedTrip ? 'Liked' : 'Did not like'}</span></td>
                      <td className="rating-remark">{rating.remark || 'No remark'}</td>
                      <td><strong>{rating.request.requestNumber}</strong><small>{rating.trip.vehicle.registrationNumber} · {rating.request.destination}</small></td>
                      <td>{rating.ratedBy.staffName}</td>
                      <td>{new Date(rating.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data.recentRatings.length && <div className="master-empty"><Star size={28} /><h3>No ratings yet</h3><p>Completed-trip ratings will appear here.</p></div>}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function RatingKpi({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return <article><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></article>;
}

function RatingValue({ value }: { value: number | null }) {
  return value == null ? <span className="driver-rating-none">No rating</span> : <span className="driver-rating-value"><Star size={14} /> <strong>{Number(value).toFixed(1)}</strong><small>/ 5</small></span>;
}
