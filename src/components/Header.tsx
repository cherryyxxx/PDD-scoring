export function Header({ sub }: { sub: string }) {
  return (
    <header className="top">
      <div className="seal" aria-hidden="true">
        评
      </div>
      <div>
        <h1>PDD绩效答辩评分</h1>
        <p>{sub}</p>
      </div>
    </header>
  );
}
