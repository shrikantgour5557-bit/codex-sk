import type { AdListing } from '../lib/mockData';

interface AdCardProps {
  ad: AdListing;
}

export function AdCard({ ad }: AdCardProps) {
  return (
    <article className="ad-card">
      <img src={ad.imageUrl} alt={ad.title} loading="lazy" />
      <div className="ad-content">
        <span className="tag">{ad.category}</span>
        <h3>{ad.title}</h3>
        <p>{ad.description}</p>
        <button type="button" className="outline-btn">View Details</button>
      </div>
    </article>
  );
}
