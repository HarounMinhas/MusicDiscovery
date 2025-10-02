import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { searchArtists } from './api.js';
import ProviderSwitcher from './components/ProviderSwitcher.js';
import './styles.css';
export default function App() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [error, setError] = useState(null);
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
    return (_jsxs("div", { className: "app", children: [_jsxs("header", { children: [_jsxs("div", { children: [_jsx("h1", { children: "MusicDiscovery" }), _jsx("p", { children: "Blended music search demo" })] }), _jsx(ProviderSwitcher, {})] }), _jsxs("main", { children: [_jsx("input", { value: query, onChange: (event) => setQuery(event.target.value), placeholder: "Zoek naar een artiest" }), error && _jsx("p", { className: "error", children: error }), _jsx("ul", { children: results.map((artist) => (_jsxs("li", { children: [artist.imageUrl && _jsx("img", { src: artist.imageUrl, alt: "" }), _jsxs("div", { children: [_jsx("strong", { children: artist.name }), artist.genres?.length ? _jsx("span", { children: artist.genres.slice(0, 2).join(', ') }) : null] })] }, artist.id))) })] })] }));
}
