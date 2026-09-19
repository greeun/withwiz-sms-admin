import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  SmsAdminProvider,
  useSmsAdminConfig,
  type ResolvedSmsAdminUiConfig,
} from '../../src/components/SmsAdminProvider';

function Probe() {
  const config = useSmsAdminConfig();
  return (
    <div>
      <span data-testid="base">{config.basePath}</span>
      <span data-testid="image">{config.resolveImageUrl('https://cdn/a.jpg', 'thumb')}</span>
    </div>
  );
}

describe('SmsAdminProvider', () => {
  it('defaults basePath to /api/admin/sms', () => {
    render(
      <SmsAdminProvider config={{ fetcher: vi.fn() }}>
        <Probe />
      </SmsAdminProvider>,
    );
    expect(screen.getByTestId('base').textContent).toBe('/api/admin/sms');
  });

  it('uses the original URL when resolveImageUrl is not given', () => {
    render(
      <SmsAdminProvider config={{ fetcher: vi.fn() }}>
        <Probe />
      </SmsAdminProvider>,
    );
    expect(screen.getByTestId('image').textContent).toBe('https://cdn/a.jpg');
  });

  it('uses the injected resolveImageUrl', () => {
    render(
      <SmsAdminProvider
        config={{ fetcher: vi.fn(), resolveImageUrl: (url, size) => `${url}?s=${size}` }}
      >
        <Probe />
      </SmsAdminProvider>,
    );
    expect(screen.getByTestId('image').textContent).toBe('https://cdn/a.jpg?s=thumb');
  });

  it('throws an error naming the hook when it is used outside the Provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(
      'The useSmsAdminConfig hook must be used inside SmsAdminProvider.',
    );
    spy.mockRestore();
  });

  it('does not throw when notify is called but was never injected', () => {
    let captured: ResolvedSmsAdminUiConfig | null = null;

    function NotifyProbe() {
      captured = useSmsAdminConfig();
      return null;
    }

    render(
      <SmsAdminProvider config={{ fetcher: vi.fn() }}>
        <NotifyProbe />
      </SmsAdminProvider>,
    );

    // sonner is an optional dependency, so the package never imports it directly. Without an
    // injected notifier the calls are silently skipped.
    expect(() => captured!.notify.success('done')).not.toThrow();
    expect(() => captured!.notify.warning('partial failure')).not.toThrow();
    expect(() => captured!.notify.error('failed')).not.toThrow();
  });

  it('uses the injected notify as is', () => {
    const notify = { success: vi.fn(), warning: vi.fn(), error: vi.fn() };
    let captured: ResolvedSmsAdminUiConfig | null = null;

    function NotifyProbe() {
      captured = useSmsAdminConfig();
      return null;
    }

    render(
      <SmsAdminProvider config={{ fetcher: vi.fn(), notify }}>
        <NotifyProbe />
      </SmsAdminProvider>,
    );

    captured!.notify.success('done');
    captured!.notify.warning('partial failure');
    expect(notify.success).toHaveBeenCalledWith('done');
    expect(notify.warning).toHaveBeenCalledWith('partial failure');
  });

  it('defaults recipientStorageKey to sms_recipients and honors an injected value', () => {
    let captured: ResolvedSmsAdminUiConfig | null = null;

    function KeyProbe() {
      captured = useSmsAdminConfig();
      return null;
    }

    const { unmount } = render(
      <SmsAdminProvider config={{ fetcher: vi.fn() }}>
        <KeyProbe />
      </SmsAdminProvider>,
    );
    expect(captured!.recipientStorageKey).toBe('sms_recipients');
    unmount();

    render(
      <SmsAdminProvider config={{ fetcher: vi.fn(), recipientStorageKey: 'other_key' }}>
        <KeyProbe />
      </SmsAdminProvider>,
    );
    expect(captured!.recipientStorageKey).toBe('other_key');
  });

  it('leaves onUploadImage undefined when it is not given', () => {
    let captured: ResolvedSmsAdminUiConfig | null = null;

    function UploadProbe() {
      captured = useSmsAdminConfig();
      return null;
    }

    render(
      <SmsAdminProvider config={{ fetcher: vi.fn() }}>
        <UploadProbe />
      </SmsAdminProvider>,
    );

    // Without an upload mechanism image attachment must stay unavailable, so there is no
    // default implementation.
    expect(captured!.onUploadImage).toBeUndefined();
  });

  it('exposes the injected onUploadImage as is', async () => {
    const onUploadImage = vi.fn().mockResolvedValue('https://cdn/uploaded.jpg');
    let captured: ResolvedSmsAdminUiConfig | null = null;

    function UploadProbe() {
      captured = useSmsAdminConfig();
      return null;
    }

    render(
      <SmsAdminProvider config={{ fetcher: vi.fn(), onUploadImage }}>
        <UploadProbe />
      </SmsAdminProvider>,
    );

    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
    await expect(captured!.onUploadImage!(file)).resolves.toBe('https://cdn/uploaded.jpg');
    expect(onUploadImage).toHaveBeenCalledWith(file);
  });
});
