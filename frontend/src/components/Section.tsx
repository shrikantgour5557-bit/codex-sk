import type { AdListing, AdCategory } from '../lib/mockData';
import { AdCard } from './AdCard';

interface SectionProps {
  title: string;
  ads?: AdListing[];
  categories?: AdCategory[];
}

export function Section({ title, ads, categories }: SectionProps) {
  return (
    <section className="container section-gap">
      <div className="section-header">
        <h2>{title}</h2>
      </div>

      {categories ? (
        <div className="category-grid">
          {categories.map((category) => (
            <button type="button" key={category} className="category-chip">
              {category}
            </button>
          ))}
        </div>
      ) : null}

      {ads ? (
        <div className="ad-grid">
          {ads.map((ad) => (
            <AdCard ad={ad} key={ad.id} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
