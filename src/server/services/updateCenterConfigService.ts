import { eq } from 'drizzle-orm';

import { db, schema } from '../db/index.js';
import { upsertSetting } from '../db/upsertSetting.js';
import type { UpdateCenterVersionSource } from './updateCenterVersionService.js';

export type UpdateCenterConfig = {
  enabled: boolean;
  helperBaseUrl: string;
  namespace: string;
  releaseName: string;
  chartRef: string;
  imageRepository: string;
  githubReleasesEnabled: boolean;
  githubReleaseRepo: string;   // GitHub 仓库地址，默认为 cita-777/metapi
  domesticReleasesEnabled: boolean;
  domesticReleaseRepo: string;  // 国内镜像仓库地址，如 xxx/mirrors/metapi
  defaultDeploySource: UpdateCenterVersionSource;
};

export const UPDATE_CENTER_CONFIG_SETTING_KEY = 'update_center_k3s_config_v1';

export function getDefaultUpdateCenterConfig(): UpdateCenterConfig {
  return {
    enabled: false,
    helperBaseUrl: '',
    namespace: 'default',
    releaseName: '',
    chartRef: '',
    imageRepository: '1467078763/metapi',
    githubReleasesEnabled: true,
    githubReleaseRepo: 'cita-777/metapi',
    domesticReleasesEnabled: false,
    domesticReleaseRepo: '',
    defaultDeploySource: 'github-release',
  };
}

function normalizeString(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  return value.trim();
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function normalizeUpdateCenterConfig(input: unknown): UpdateCenterConfig {
  const defaults = getDefaultUpdateCenterConfig();
  const record = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const defaultDeploySource = record.defaultDeploySource === 'domestic-release'
    ? 'domestic-release'
    : 'github-release';

  return {
    enabled: normalizeBoolean(record.enabled, defaults.enabled),
    helperBaseUrl: normalizeString(record.helperBaseUrl, defaults.helperBaseUrl),
    namespace: normalizeString(record.namespace, defaults.namespace) || defaults.namespace,
    releaseName: normalizeString(record.releaseName, defaults.releaseName),
    chartRef: normalizeString(record.chartRef, defaults.chartRef),
    imageRepository: normalizeString(record.imageRepository, defaults.imageRepository) || defaults.imageRepository,
    githubReleasesEnabled: normalizeBoolean(record.githubReleasesEnabled, defaults.githubReleasesEnabled),
    githubReleaseRepo: normalizeString(record.githubReleaseRepo, defaults.githubReleaseRepo) || defaults.githubReleaseRepo,
    domesticReleasesEnabled: normalizeBoolean(record.domesticReleasesEnabled, defaults.domesticReleasesEnabled),
    domesticReleaseRepo: normalizeString(record.domesticReleaseRepo, defaults.domesticReleaseRepo),
    defaultDeploySource,
  };
}

export async function loadUpdateCenterConfig(): Promise<UpdateCenterConfig> {
  const row = await db.select().from(schema.settings).where(eq(schema.settings.key, UPDATE_CENTER_CONFIG_SETTING_KEY)).get();
  if (!row?.value) {
    return getDefaultUpdateCenterConfig();
  }

  try {
    return normalizeUpdateCenterConfig(JSON.parse(row.value));
  } catch {
    return getDefaultUpdateCenterConfig();
  }
}

export async function saveUpdateCenterConfig(input: unknown): Promise<UpdateCenterConfig> {
  const next = normalizeUpdateCenterConfig(input);
  await upsertSetting(UPDATE_CENTER_CONFIG_SETTING_KEY, next);
  return next;
}
