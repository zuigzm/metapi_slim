export type UpdateVersionCandidateLike = {
  normalizedVersion?: string | null;
  displayVersion?: string | null;
  tagName?: string | null;
  digest?: string | null;
};

export type UpdateHelperRuntimeLike = {
  imageTag?: string | null;
  imageDigest?: string | null;
};

export type UpdateReminderCandidate = {
  source: 'github-release' | 'domestic-release';
  kind: 'new-version' | 'new-digest';
  candidateKey: string;
  displayVersion: string;
  tagName: string;
  digest: string | null;
};

const STABLE_SEMVER_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)(?:\+[\w.-]+)?$/i;

function normalizeString(value?: string | null): string {
  return String(value || '').trim();
}

function normalizeDigest(value?: string | null): string {
  const digest = normalizeString(value);
  return /^sha256:[a-f0-9]{64}$/i.test(digest) ? digest.toLowerCase() : '';
}

function normalizeStableTag(value?: string | null): string {
  return normalizeStableVersion(value);
}

function hasSameImageTag(left?: string | null, right?: string | null): boolean {
  const rawLeft = normalizeString(left);
  const rawRight = normalizeString(right);
  if (!rawLeft || !rawRight) return false;

  const stableLeft = normalizeStableTag(left);
  const stableRight = normalizeStableTag(right);
  if (stableLeft && stableRight) {
    return stableLeft === stableRight;
  }

  return rawLeft === rawRight;
}

export function normalizeStableVersion(value?: string | null): string {
  const raw = normalizeString(value);
  if (!raw) return '';
  const match = raw.match(STABLE_SEMVER_PATTERN);
  if (!match) return '';
  return [
    Number.parseInt(match[1], 10),
    Number.parseInt(match[2], 10),
    Number.parseInt(match[3], 10),
  ].join('.');
}

export function compareStableVersions(left?: string | null, right?: string | null): number | null {
  const normalizedLeft = normalizeStableVersion(left);
  const normalizedRight = normalizeStableVersion(right);
  if (!normalizedLeft || !normalizedRight) return null;

  const leftParts = normalizedLeft.split('.').map((item) => Number.parseInt(item, 10));
  const rightParts = normalizedRight.split('.').map((item) => Number.parseInt(item, 10));
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] === rightParts[index]) continue;
    return leftParts[index] < rightParts[index] ? -1 : 1;
  }
  return 0;
}

export function isSameImageTarget(
  current: UpdateHelperRuntimeLike | null | undefined,
  target: { tag?: string | null; digest?: string | null },
): boolean {
  const currentDigest = normalizeDigest(current?.imageDigest);
  const targetDigest = normalizeDigest(target.digest);
  if (currentDigest && targetDigest) {
    return currentDigest === targetDigest;
  }

  return hasSameImageTag(current?.imageTag, target.tag);
}

export function buildUpdateReminderCandidateKey(
  source: 'github-release' | 'domestic-release',
  candidate: { tagName?: string | null; digest?: string | null },
): string {
  const tagName = normalizeString(candidate.tagName);
  const digest = normalizeDigest(candidate.digest);
  if (!tagName) return '';
  if (source === 'domestic-release' && digest) {
    return `${source}:${tagName}@${digest}`;
  }
  return `${source}:${tagName}`;
}

export function resolveUpdateReminderCandidate(input: {
  currentVersion?: string | null;
  helper: UpdateHelperRuntimeLike | null | undefined;
  githubRelease: UpdateVersionCandidateLike | null | undefined;
  domesticRelease: UpdateVersionCandidateLike | null | undefined;
}): UpdateReminderCandidate | null {
  const githubCandidateVersion = normalizeString(input.githubRelease?.normalizedVersion);
  const githubTag = normalizeString(input.githubRelease?.tagName || githubCandidateVersion);
  if (githubTag) {
    const githubTargetVersion = githubCandidateVersion || githubTag;
    const versionCompare = compareStableVersions(input.currentVersion, githubTargetVersion);
    const helperVersionCompare = compareStableVersions(input.helper?.imageTag, githubTargetVersion);
    if (versionCompare === -1 && (helperVersionCompare == null || helperVersionCompare === -1)) {
      return {
        source: 'github-release',
        kind: 'new-version',
        candidateKey: buildUpdateReminderCandidateKey('github-release', { tagName: githubTag, digest: null }),
        displayVersion: normalizeString(input.githubRelease?.displayVersion || input.githubRelease?.normalizedVersion || githubTag),
        tagName: githubTag,
        digest: null,
      };
    }
  }

  const domesticCandidateVersion = normalizeString(input.domesticRelease?.normalizedVersion);
  const domesticTag = normalizeString(input.domesticRelease?.tagName || domesticCandidateVersion);
  const domesticDigest = normalizeDigest(input.domesticRelease?.digest);
  if (!domesticTag) return null;

  if (isSameImageTarget(input.helper, { tag: domesticTag, digest: domesticDigest })) {
    return null;
  }

  const domesticVersionCompare = compareStableVersions(input.currentVersion, domesticCandidateVersion || domesticTag);
  if (domesticVersionCompare === -1) {
    return {
      source: 'domestic-release',
      kind: 'new-version',
      candidateKey: buildUpdateReminderCandidateKey('domestic-release', { tagName: domesticTag, digest: domesticDigest || null }),
      displayVersion: normalizeString(input.domesticRelease?.displayVersion || input.domesticRelease?.normalizedVersion || domesticTag),
      tagName: domesticTag,
      digest: domesticDigest || null,
    };
  }

  const helperDigest = normalizeDigest(input.helper?.imageDigest);
  if (domesticDigest && helperDigest && hasSameImageTag(input.helper?.imageTag, domesticTag) && helperDigest !== domesticDigest) {
    return {
      source: 'domestic-release',
      kind: 'new-digest',
      candidateKey: buildUpdateReminderCandidateKey('domestic-release', { tagName: domesticTag, digest: domesticDigest }),
      displayVersion: normalizeString(input.domesticRelease?.displayVersion || input.domesticRelease?.normalizedVersion || domesticTag),
      tagName: domesticTag,
      digest: domesticDigest,
    };
  }

  return null;
}
