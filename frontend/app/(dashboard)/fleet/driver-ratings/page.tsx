'use client';

import { PageHeader } from '@/components/page-header';
import { AlertTriangle, MessageSquareText, Search, Star, ThumbsUp, Users } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

type Rating = {
  id: string;
  stars: number;
  likedTrip: boolean;
  remark?: string | null;
  createdAt: string;
  driver: { id: string; staffName: string; employeeId: string };
  ratedBy: { staffName: string };
  request: { requestNumber: string; destination: string };
  trip: { vehicle: { registrationNumber: string } };
};

type RatingData = {
  metrics: {
    totalDrivers: number;
    ratedDrivers: number;
    totalRatings: number;
    goodRatings: number;
    badRatings: number;
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
  recentRatings: Rating[];
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
  const badRatings = data?.recentRatings.filter((rating) => rating.stars <= 3) ?? [];
  const goodRatings = data?.recentRatings.filter((rating) => rating.stars >= 4) ?? [];

  return (
    <>
      <PageHeader
        title="Driver Ratings"
        description="Review low ratings and recognise positive driver feedback."
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
            <RatingKpi icon={<MessageSquareText size={19} />} label="All ratings" value={data.metrics.totalRatings} />
            <RatingKpi icon={<AlertTriangle size={19} />} label="Needs review" value={data.metrics.badRatings} tone="bad" />
            <RatingKpi icon={<ThumbsUp size={19} />} label="Good ratings" value={data.metrics.goodRatings} tone="good" />
          </section>

          <RatingFeedbackPanel
            title="Ratings needing review"
            description="Journeys rated 1–3 stars. Review these first and follow up where necessary."
            ratings={badRatings}
            emptyTitle="No bad ratings"
            emptyText="Ratings of 1–3 stars will appear here for review."
            tone="bad"
          />

          <RatingFeedbackPanel
            title="Good ratings"
            description="Journeys rated 4–5 stars and positive driver feedback."
            ratings={goodRatings}
            emptyTitle="No good ratings yet"
            emptyText="Ratings of 4–5 stars will appear here."
            tone="good"
          />

          <section className="master-panel driver-ratings-panel">
            <div className="panel-heading">
              <div><h2>All drivers</h2><p>Average rating and review count for each driver.</p></div>
              <label className="master-search">
                <Search size={16} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search driver, ID or location" />
              </label>
            </div>
            <div className="master-table-wrap">
              <table className="master-table driver-ratings-table">
                <thead><tr><th>Driver</th><th>Rating</th><th>Reviews</th><th>Location</th><th>Status</th></tr></thead>
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
        </div>
      )}
    </>
  );
}

function RatingFeedbackPanel({
  title,
  description,
  ratings,
  emptyTitle,
  emptyText,
  tone,
}: {
  title: string;
  description: string;
  ratings: Rating[];
  emptyTitle: string;
  emptyText: string;
  tone: 'good' | 'bad';
}) {
  return (
    <section className={`master-panel driver-ratings-panel rating-group-panel ${tone}`}>
      <div className="panel-heading">
        <div><h2>{title}</h2><p>{description}</p></div>
        <span className={`rating-group-count ${tone}`}>{ratings.length}</span>
      </div>
      <div className="master-table-wrap">
        <table className="master-table driver-rating-feedback-table">
          <thead><tr><th>Driver</th><th>Rating</th><th>Liked trip</th><th>Remark</th><th>Trip</th><th>Rated by</th><th>Date</th></tr></thead>
          <tbody>
            {ratings.map((rating) => (
              <tr key={rating.id}>
                <td><strong>{rating.driver.staffName}</strong><small>{rating.driver.employeeId}</small></td>
                <td><RatingValue value={rating.stars} /></td>
                <td><span className={rating.likedTrip ? 'rating-positive' : 'rating-negative'}>{rating.likedTrip ? 'Yes' : 'No'}</span></td>
                <td className="rating-remark">{rating.remark || 'No remark'}</td>
                <td><strong>{rating.request.requestNumber}</strong><small>{rating.trip.vehicle.registrationNumber} · {rating.request.destination}</small></td>
                <td>{rating.ratedBy.staffName}</td>
                <td>{new Date(rating.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!ratings.length && <div className="master-empty"><Star size={28} /><h3>{emptyTitle}</h3><p>{emptyText}</p></div>}
      </div>
    </section>
  );
}

function RatingKpi({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string | number; tone?: 'good' | 'bad' }) {
  return <article className={tone ? `rating-kpi-${tone}` : undefined}><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></article>;
}

function RatingValue({ value }: { value: number | null }) {
  return value == null ? <span className="driver-rating-none">No rating</span> : <span className="driver-rating-value"><Star size={14} /> <strong>{Number(value).toFixed(1)}</strong><small>/ 5</small></span>;
}
