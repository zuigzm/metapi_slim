import { describe, expect, it } from 'vitest';
import { create } from 'react-test-renderer';
import { MemoryRouter } from 'react-router-dom';
import SiteBadgeLink from './SiteBadgeLink.js';

describe('SiteBadgeLink', () => {
  it('renders a focus-navigation link when site id is valid', () => {
    const root = create(
      <MemoryRouter>
        <SiteBadgeLink siteId={7} siteName="Demo Site" />
      </MemoryRouter>,
    );

    const link = root.root.findByType('a');
    expect(String(link.props.href || '')).toContain('/sites?focusSiteId=7');
    expect(String(link.props.className || '')).toContain('badge-link');
    expect(root.root.findByProps({ className: 'badge badge-muted' }).children.join('')).toContain('Demo Site');

    root.unmount();
  });

  it('falls back to plain badge text when site id is invalid', () => {
    const root = create(
      <MemoryRouter>
        <SiteBadgeLink siteId={0} siteName="Unknown Site" />
      </MemoryRouter>,
    );

    expect(root.root.findAllByType('a')).toHaveLength(0);
    expect(root.root.findByProps({ className: 'badge badge-muted' }).children.join('')).toContain('Unknown Site');

    root.unmount();
  });

  it('renders an external anchor when siteUrl is provided', () => {
    const root = create(
      <MemoryRouter>
        <SiteBadgeLink siteId={7} siteName="Demo Site" siteUrl="https://example.com" />
      </MemoryRouter>,
    );

    const anchor = root.root.findByType('a');
    expect(anchor.props.href).toBe('https://example.com');
    expect(anchor.props.target).toBe('_blank');
    expect(anchor.props.rel).toBe('noopener noreferrer');
    expect(anchor.children[0].props.className).toContain('badge badge-muted');
    expect(anchor.children[0].children.join('')).toContain('Demo Site');

    root.unmount();
  });

  it('falls back to internal link when siteUrl is empty despite valid siteId', () => {
    const root = create(
      <MemoryRouter>
        <SiteBadgeLink siteId={7} siteName="Demo Site" siteUrl="" />
      </MemoryRouter>,
    );

    const link = root.root.findByType('a');
    expect(String(link.props.href || '')).toContain('/sites?focusSiteId=7');

    root.unmount();
  });
});
