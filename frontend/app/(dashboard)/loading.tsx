export default function Loading() {
  return (
    <div className="page-loading" aria-label="Loading page">
      <div className="skeleton breadcrumb-skeleton" />
      <div className="skeleton title-skeleton" />
      <div className="skeleton subtitle-skeleton" />
      <div className="skeleton-grid">
        {[0, 1, 2, 3].map((item) => (
          <div className="skeleton card-skeleton" key={item} />
        ))}
      </div>
      <div className="skeleton content-skeleton" />
    </div>
  );
}
