import { Routes, Route } from 'react-router-dom';
import { Header } from '../components/Header';
import { SearchBar } from '../components/SearchBar';
import { Section } from '../components/Section';
import { Footer } from '../components/Footer';
import { categories, featuredAds, latestAds } from '../lib/mockData';

function HomePage() {
  return (
    <>
      <Header />
      <main>
        <SearchBar />
        <Section title="Categories" categories={categories} />
        <Section title="Featured Ads" ads={featuredAds} />
        <Section title="Latest Ads" ads={latestAds} />
      </main>
      <Footer />
    </>
  );
}

function Placeholder({ title }: { title: string }) {
  return (
    <div className="container placeholder-page">
      <h1>{title}</h1>
      <p>This page is part of the frontend flow and should connect to backend APIs.</p>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<Placeholder title="Login" />} />
      <Route path="/register" element={<Placeholder title="Register" />} />
      <Route path="/dashboard" element={<Placeholder title="User Dashboard" />} />
      <Route path="/admin" element={<Placeholder title="Admin Dashboard" />} />
      <Route path="/ads/:id" element={<Placeholder title="Ad Details" />} />
    </Routes>
  );
}
