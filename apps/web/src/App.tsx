import React, { useEffect, useState } from 'react';
import type { Artist } from '@musicdiscovery/shared';
import { searchArtists } from './api.js';
import ProviderSwitcher from './components/ProviderSwitcher.js';
import './styles.css';

export default function App(): JSX.Element {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Artist[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setError(null);
      return;
    }

    const handle = setTimeout(() => {
      searchArtists(query.trim(), 5)
        .then((items) => {
          setResults(items);
          setError(null);
        })
        .catch((err) => setError(err instanceof Error ? err.message : String(err)));
    }, 250);

    return () => clearTimeout(handle);
  }, [query]);

  return (
    <div className="app">
      <header>
        <div>
          <h1>MusicDiscovery</h1>
          <p>Blended music search demo</p>
        </div>
        <ProviderSwitcher />
      </header>
      <main>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Zoek naar een artiest"
        />
        {error && <p className="error">{error}</p>}
        <ul>
          {results.map((artist) => (
            <li key={artist.id}>
              {artist.imageUrl && <img src={artist.imageUrl} alt="" />}
              <div>
                <strong>{artist.name}</strong>
                {artist.genres?.length ? <span>{artist.genres.slice(0, 2).join(', ')}</span> : null}
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
