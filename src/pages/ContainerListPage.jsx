import { Link } from 'react-router-dom';

function formattedDate(value) {
  return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ContainerListPage({ containers, loading, onImport }) {
  return (
    <main>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Organização</p>
          <h1>Seus contêineres</h1>
          <p className="muted">Cada contêiner tem sua própria página e lista de produtos.</p>
        </div>
        <button className="btn" type="button" onClick={onImport}>+ Novo contêiner</button>
      </section>

      {loading ? (
        <p className="empty-state">Carregando contêineres…</p>
      ) : containers.length ? (
        <section className="container-grid" aria-label="Contêineres cadastrados">
          {containers.map((container, index) => (
            <Link className="container-card" to={`/containers/${container.id}`} key={container.id}>
              <span className="container-number">{index + 1}</span>
              <span className="container-card-content">
                <strong>{container.nome}</strong>
                <small>Criado em {formattedDate(container.created_at)}</small>
              </span>
              <span className="container-arrow" aria-hidden="true">→</span>
            </Link>
          ))}
        </section>
      ) : (
        <section className="empty-card">
          <div className="empty-icon" aria-hidden="true">↓</div>
          <h2>Seu primeiro contêiner</h2>
          <p className="muted">Importe uma planilha para começar a organizar produtos e calcular preços.</p>
          <button className="btn" type="button" onClick={onImport}>Importar planilha</button>
          <p className="drop-tip">Ou arraste um arquivo para qualquer lugar desta página.</p>
        </section>
      )}
    </main>
  );
}
