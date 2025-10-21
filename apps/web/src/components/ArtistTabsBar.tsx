import React, { useEffect, useMemo, useRef } from 'react';

export interface ArtistTabItem {
  id: string;
  name: string;
  imageUrl?: string;
}

export interface ArtistTabsBarProps {
  tabs: ArtistTabItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}

export default function ArtistTabsBar({ tabs, activeId, onSelect, onClose }: ArtistTabsBarProps) {
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    if (!activeId) {
      return;
    }
    const node = tabRefs.current[activeId];
    if (node) {
      node.focus();
    }
  }, [activeId]);

  const orderedTabs = useMemo(() => tabs, [tabs]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number, id: string) => {
    if (!orderedTabs.length) {
      return;
    }

    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      const nextIndex = (index + direction + orderedTabs.length) % orderedTabs.length;
      const nextTab = orderedTabs[nextIndex];
      onSelect(nextTab.id);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      onSelect(orderedTabs[0].id);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      onSelect(orderedTabs[orderedTabs.length - 1].id);
      return;
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      onClose(id);
    }
  };

  return (
    <div className="artist-tabsbar" role="tablist" aria-label="Geopende artiesten">
      {orderedTabs.map((tab, index) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            className={`artist-tab${isActive ? ' artist-tab--active' : ''}`}
            onClick={() => onSelect(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index, tab.id)}
            title={tab.name}
            ref={(node) => {
              tabRefs.current[tab.id] = node;
            }}
          >
            <span
              className="artist-tab__close"
              role="presentation"
              aria-label={`Sluit ${tab.name}`}
              title={`Sluit ${tab.name}`}
              onClick={(event) => {
                event.stopPropagation();
                onClose(tab.id);
              }}
            >
              ×
            </span>
            {tab.imageUrl ? (
              <img className="artist-tab__thumb" src={tab.imageUrl} alt="" />
            ) : (
              <span className="artist-tab__thumb artist-tab__thumb--placeholder" aria-hidden="true">
                {tab.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="artist-tab__label">{tab.name}</span>
          </button>
        );
      })}
    </div>
  );
}
