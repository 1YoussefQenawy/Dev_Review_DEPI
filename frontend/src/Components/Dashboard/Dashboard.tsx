export default function Dashboard() {
  return (
    <div className="custom-bg min-vh-100 text">
      <div className="container py-4">
        <h1 className="fw-bold mb-4">Dashboard</h1>

        <section className="mb-4">
          <h2 className="mb-3">Overview</h2>
          <div className="row g-3">
            <div className="col-md-4">
              <div className="cards-sidebar p-3 rounded-3 shadow-sm">
                <p className="mb-1">Total Snippets</p>
                <strong>--</strong>
              </div>
            </div>

            <div className="col-md-4">
              <div className="cards-sidebar p-3 rounded-3 shadow-sm">
                <p className="mb-1">Total Reviews</p>
                <strong>--</strong>
              </div>
            </div>

            <div className="col-md-4">
              <div className="cards-sidebar p-3 rounded-3 shadow-sm">
                <p className="mb-1">Average Score</p>
                <strong>--</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-4">
          <h2 className="mb-3">Recent Snippets</h2>
          <div className="cards-sidebar p-4 rounded-3 shadow-sm">
            <p className=" mb-0 text-white">No snippets yet.</p>
          </div>
        </section>

        <button type="button" className="action-button button_hover text-white px-4 py-2 border-0 rounded-pill">
          Upload New Code
        </button>
      </div>
    </div>
  );
}