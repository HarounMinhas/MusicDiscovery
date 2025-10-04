import { env } from '../env.js';

export interface SmartRelatedConfig {
  enabled: boolean;
  cacheTtlMs: number;
  maxMembers: number;
  defaultUseFallback: boolean;
}

const config: SmartRelatedConfig = {
  enabled: env.SMART_RELATED_ENABLED,
  cacheTtlMs: env.SMART_RELATED_CACHE_TTL_SECONDS * 1000,
  maxMembers: env.SMART_RELATED_MAX_MEMBERS,
  defaultUseFallback: env.SMART_RELATED_ENABLED
};

export function getSmartRelatedConfig(): SmartRelatedConfig {
  return config;
}

export function overrideSmartRelatedConfig(partial: Partial<SmartRelatedConfig>) {
  Object.assign(config, partial);
}
