import React from 'react';

export type BackgroundMode = 'static' | 'animated';

type BackgroundToggleProps = {
  value: BackgroundMode;
  onChange: (value: BackgroundMode) => void;
};

const OPTIONS: Array<{ value: BackgroundMode; label: string }> = [
  { value: 'static', label: 'Statisch' },
  { value: 'animated', label: 'Dynamisch' }
];

export default function BackgroundToggle({ value, onChange }: BackgroundToggleProps) {
  return (
    <div className="background-toggle">
      <span className="label background-toggle__label">Achtergrond</span>
      <div className="background-toggle__buttons" role="group" aria-label="Achtergrond">
        {OPTIONS.map((option) => {
          const isActive = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              className={`background-toggle__button${isActive ? ' is-active' : ''}`}
              aria-pressed={isActive}
              onClick={() => {
                if (!isActive) {
                  onChange(option.value);
                }
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
