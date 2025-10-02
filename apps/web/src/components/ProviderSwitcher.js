import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { PROVIDERS } from '@musicdiscovery/shared';
import { getProviderCatalog } from '../api.js';
import { getSelectedProvider, setSelectedProvider, syncProviderSelection } from '../providerSelection.js';
export default function ProviderSwitcher() {
    const [options, setOptions] = useState(PROVIDERS);
    const [value, setValue] = useState(() => getSelectedProvider());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const catalog = await getProviderCatalog();
                if (cancelled)
                    return;
                setOptions(catalog.items);
                const next = syncProviderSelection(catalog.items.map((item) => item.id), catalog.default);
                setValue(next);
                setError(null);
            }
            catch (err) {
                if (cancelled)
                    return;
                setError('Kon providers niet laden');
                console.error('Failed to load provider metadata', err);
            }
            finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);
    function handleChange(event) {
        const next = event.target.value;
        if (next === value)
            return;
        setSelectedProvider(next);
        setValue(next);
        window.location.reload();
    }
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }, children: [_jsxs("label", { style: { display: 'flex', alignItems: 'center', gap: 8 }, children: [_jsx("span", { className: "label", children: "Provider" }), _jsx("select", { value: value, onChange: handleChange, disabled: loading && options.length === 0, style: {
                            background: '#0f1320',
                            color: 'white',
                            borderRadius: 8,
                            border: '1px solid #2a334c',
                            padding: '6px 10px'
                        }, children: options.map((option) => (_jsx("option", { value: option.id, children: option.label }, option.id))) })] }), error ? _jsx("span", { className: "label", style: { color: '#ffb4b4' }, children: error }) : null] }));
}
