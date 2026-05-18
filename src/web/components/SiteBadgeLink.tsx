import React from 'react';
import { Link } from 'react-router-dom';

type SiteBadgeLinkProps = {
  siteId?: number | null;
  siteName?: string | null;
  siteUrl?: string | null;
  className?: string;
  badgeClassName?: string;
  badgeStyle?: React.CSSProperties;
};

export default function SiteBadgeLink({
  siteId,
  siteName,
  siteUrl,
  className = 'badge-link',
  badgeClassName = 'badge badge-muted',
  badgeStyle,
}: SiteBadgeLinkProps) {
  const label = String(siteName || '').trim() || '-';
  const normalizedSiteId = Number(siteId);
  const normalizedUrl = String(siteUrl || '').trim();

  if (!Number.isFinite(normalizedSiteId) || normalizedSiteId <= 0) {
    return (
      <span className={badgeClassName} style={badgeStyle}>
        {label}
      </span>
    );
  }

  if (normalizedUrl) {
    return (
      <a
        href={normalizedUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        <span className={badgeClassName} style={badgeStyle}>
          {label}
        </span>
      </a>
    );
  }

  return (
    <Link to={`/sites?focusSiteId=${Math.trunc(normalizedSiteId)}`} className={className}>
      <span className={badgeClassName} style={badgeStyle}>
        {label}
      </span>
    </Link>
  );
}
