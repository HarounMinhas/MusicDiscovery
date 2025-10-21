import React, { useEffect, useRef } from 'react';

export interface ArtistTabItem {
  id: string;
  name: string;
  imageUrl?: string;
}

interface ArtistTabsBarProps {
  tabs: ArtistTabItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}

export default function ArtistTabsBar({ tabs, activeId, onSelect, onClose }: ArtistTabsBarProps) {
  const tabRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!activeId) {
      return;
    }

    const node = tabRefs.current[activeId];
    if (!node) {
      return;
    }

    node.focus({ preventScroll: true });

    const parent = node.parentElement;
    if (!parent) {
      return;
    }

    const parentLeft = parent.scrollLeft;
    const parentRight = parentLeft + parent.clientWidth;
    const nodeLeft = node.offsetLeft;
    const nodeRight = nodeLeft + node.clientWidth;

    if (nodeLeft >= parentLeft && nodeRight <= parentRight) {
      return;
    }

    const target = nodeLeft - parent.clientWidth / 2 + node.clientWidth / 2;
    parent.scrollTo({
      left: Math.max(0, target),
      behavior: 'smooth'
    });
  }, [activeId]);

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="artist-tabsbar" role="tablist" aria-label="Geopende artiesten">
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeId;
        const className = `artist-tab${isActive ? ' artist-tab--active' : ''}`;
        const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
          if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
            event.preventDefault();
            if (tabs.length === 0) {
              return;
            }
            const direction = event.key === 'ArrowRight' ? 1 : -1;
            const nextIndex = (index + direction + tabs.length) % tabs.length;
            onSelect(tabs[nextIndex].id);
            return;
          }
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect(tab.id);
            return;
          }
          if (event.key === 'Delete' || event.key === 'Backspace') {
            event.preventDefault();
            onClose(tab.id);
          }
        };

        return (
          <div
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            className={className}
            ref={(node) => {
              if (node) {
                tabRefs.current[tab.id] = node;
              } else {
                delete tabRefs.current[tab.id];
              }
            }}
            onClick={() => onSelect(tab.id)}
            onKeyDown={handleKeyDown}
            title={tab.name}
          >
            <button
              type="button"
              className="artist-tab__close"
              aria-label={`Sluit ${tab.name}`}
              onClick={(event) => {
                event.stopPropagation();
                onClose(tab.id);
              }}
            >
              ×
            </button>
            {tab.imageUrl ? (
              <img className="artist-tab__thumb" src={tab.imageUrl} alt="" />
            ) : (
              <div className="artist-tab__thumb artist-tab__thumb--placeholder" aria-hidden="true">
                {tab.name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <span className="artist-tab__label">{tab.name}</span>
          </div>
        );
      })}
    </div>
  );
}
