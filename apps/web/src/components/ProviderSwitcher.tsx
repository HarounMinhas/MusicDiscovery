import type React from 'react';
import type { ProviderId, ProviderMetadata } from '@musicdiscovery/shared';

import type { ProviderStatus } from '../hooks/useProviderSelection';

// Provider switching is intentionally disabled for the GitHub Pages deployment.
// Keeping the prop signature avoids touching unrelated layout code.
interface ProviderSwitcherProps {
  value: ProviderId;
  status: ProviderStatus;
  error: string | null;
  options: ProviderMetadata[];
  onChange: (provider: ProviderId) => void;
}

export default function ProviderSwitcher(_props: ProviderSwitcherProps): React.ReactNode {
  return null;
}
