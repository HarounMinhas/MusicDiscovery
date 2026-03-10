import React from 'react';

import { useI18n } from '../i18n';

export type ThemeMode = 'light' | 'dark' | 'studio' | 'studio-white';

type ThemeToggleProps = {
  value: ThemeMode;
  onChange: (value: ThemeMode) => void;
};

export default function ThemeToggle({ value, onChange }: ThemeToggleProps) {
  const { t } = useI18n();

  return (
    <div className="background-toggle">
      <span className="label background-toggle__label">{t('theme.label')}</span>
      <label className="background-toggle__switch">
        <select
          className="settings-select"
          value={value}
          onChange={(event) => {
            onChange(event.target.value as ThemeMode);
          }}
          aria-label={t('theme.label')}
        >
          <option value="dark">{t('theme.dark')}</option>
          <option value="light">{t('theme.light')}</option>
          <option value="studio">{t('theme.studio')}</option>
          <option value="studio-white">{t('theme.studioWhite')}</option>
        </select>
      </label>
    </div>
  );
}
