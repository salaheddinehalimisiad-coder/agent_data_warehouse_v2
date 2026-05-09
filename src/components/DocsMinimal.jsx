import React, { useState } from 'react';
import { Book, Search } from 'lucide-react';

export default function DocsMinimal() {
  const [q, setQ] = useState('');
  return (
    <div style={{ minHeight: '100vh', background: '#09090b', color: 'white', padding: 40 }}>
      <h1 style={{ fontSize: 24, marginBottom: 20 }}>Documentation Agent DW</h1>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <Book size={18} />
        <Search size={14} />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Rechercher..."
          style={{ padding: 8, borderRadius: 6, border: '1px solid #333', background: '#111', color: 'white' }}
        />
      </div>
      <p style={{ marginTop: 20, color: '#888' }}>
        Ce composant minimal fonctionne. Le problème est dans DocumentationPage.jsx.
      </p>
    </div>
  );
}
