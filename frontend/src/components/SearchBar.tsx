export function SearchBar() {
  return (
    <section className="search-wrap container">
      <h1>Promote what you sell, offer, or build.</h1>
      <p>Post free ads with limits, or upgrade to featured placement for better reach.</p>
      <div className="search-box">
        <input type="text" placeholder="Search by keyword, category, or location" aria-label="Search ads" />
        <button type="button" className="primary-btn">Search</button>
      </div>
    </section>
  );
}
