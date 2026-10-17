export default function Dashboard() {
  return (
    <div>
      <h1>Welcome</h1>

      <section>
        <h2>Overview</h2>
        <div>
          <p>Total Snippets</p>
          <strong>--</strong>
        </div>
        <div>
          <p>Total Reviews</p>
          <strong>--</strong>
        </div>
        <div>
          <p>Average Score</p>
          <strong>--</strong>
        </div>
      </section>

      <section>
        <h2>Recent Snippets</h2>
        <p>No snippets yet.</p>
      </section>

      <button type="button">Upload New Code</button>
    </div>
  );
}