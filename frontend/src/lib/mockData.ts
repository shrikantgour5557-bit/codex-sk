export type AdCategory = 'Business' | 'Jobs' | 'Services' | 'Digital' | 'Local Ads';

export interface AdListing {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  category: AdCategory;
  featured?: boolean;
}

export const categories: AdCategory[] = ['Business', 'Jobs', 'Services', 'Digital', 'Local Ads'];

export const featuredAds: AdListing[] = [
  {
    id: 'f-1',
    title: 'Premium Web Design for Startups',
    description: 'Launch your startup with a conversion-focused website in 7 days.',
    imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=900&q=80',
    category: 'Digital',
    featured: true
  },
  {
    id: 'f-2',
    title: 'Local Plumbing Service - 24/7',
    description: 'Fast home plumbing support with guaranteed service quality.',
    imageUrl: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=900&q=80',
    category: 'Services',
    featured: true
  }
];

export const latestAds: AdListing[] = [
  {
    id: 'l-1',
    title: 'Part-Time Graphic Designer Needed',
    description: 'Hiring creative designers for social media campaigns.',
    imageUrl: 'https://images.unsplash.com/photo-1626785774573-4b799315345d?auto=format&fit=crop&w=900&q=80',
    category: 'Jobs'
  },
  {
    id: 'l-2',
    title: 'Organic Snacks Wholesale Supply',
    description: 'Bulk healthy snacks for stores and gyms with weekly delivery.',
    imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80',
    category: 'Business'
  },
  {
    id: 'l-3',
    title: 'Run Facebook & Google Ads',
    description: 'Performance marketing service for SMB growth and lead generation.',
    imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=900&q=80',
    category: 'Digital'
  }
];
