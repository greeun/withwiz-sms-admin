# @withwiz/sms-admin

**English** | [Korean](./README.ko.md)

SMS delivery history and template management service with an admin UI. It runs on a provider injected from `@withwiz/sms-core`.

## Installation

```bash
pnpm add @withwiz/sms-admin @withwiz/sms-core
```

`@prisma/client` and `react` are peer dependencies, so the versions the consuming project already has are used as they are. This package assumes a Next.js project. `sonner` is a peer dependency as well, but an optional one: the package never imports `sonner` directly and instead receives notification functions through the `notify` option of `SmsAdminProvider`, so everything works without it installed — only the notifications are not displayed.

## Prisma schema

Copy `prisma/sms.prisma` into the schema directory of the consuming project.

```bash
cp node_modules/@withwiz/sms-admin/prisma/sms.prisma prisma/schema/sms/
```

## Server usage

Provider adapters are imported from a subpath of `@withwiz/sms-core` rather than from its root entry point. Re-exporting them from the root would mix server-only code into the client bundle.

```typescript
import { createSmsAdmin } from '@withwiz/sms-admin/facade';
import { createAligoProvider } from '@withwiz/sms-core/providers/aligo';

export const smsAdmin = createSmsAdmin({
  prisma,
  provider: createAligoProvider({ credentials: loadCredentials }),
  logger,
  // Reads the sender number. It is read at call time so that a settings change takes effect immediately.
  sender: async () => (await getSettings(['sms_sender'])).sms_sender ?? '',
});
```

`smsAdmin` exposes the following surface.

```typescript
// Sending
const result = await smsAdmin.messages.send({
  type: 'SMS',
  content: 'This is a notification message.',
  recipients: [{ name: 'Hong Gildong', phone: '010-1234-5678' }],
  source: 'briefing',
});

// Listing, inspecting and deleting delivery history
const { items, total } = await smsAdmin.messages.list({ page: 1, limit: 20 });
const detail = await smsAdmin.messages.detail(result.messageId);
await smsAdmin.messages.remove([result.messageId]);

// Template management
const templates = await smsAdmin.templates.list({ search: 'admission' });
await smsAdmin.templates.create({ name: 'Admission notice', type: 'SMS', content: '...' });

// Remaining message quota, CSV export
const remain = await smsAdmin.remain();
const csv = smsAdmin.csv.buildMessageCsv(items);
```

The configuration options of `createSmsAdmin` are the following.

| Option | Description |
|--------|-------------|
| `prisma` | The consuming project's `PrismaClient`. It must be able to reach the three models defined by `sms.prisma` |
| `provider` | An `SmsProvider` implementation from `@withwiz/sms-core` (for example `createAligoProvider` from `@withwiz/sms-core/providers/aligo`) |
| `logger` | A minimal logger interface with `info` / `warn` / `error` |
| `sender` | A function that reads the sender number. It is called on every send, so a settings change takes effect immediately |

The errors thrown by the service fall into two groups. When the caller's input is wrong — an invalid sort key, a missing required field — the service throws `SmsValidationError`; every other error (a failed Prisma connection, an update or delete against a non-existent id, and so on) is propagated as a plain `Error`. The consuming project should tell the two apart with `isSmsValidationError`, answering validation errors with 400 and everything else with a 500 that does not expose the internal message.

```typescript
import { isSmsValidationError } from '@withwiz/sms-admin';

try {
  const { items, total } = await smsAdmin.templates.list({ sort: req.query.sort });
  return NextResponse.json({ success: true, data: { items, total } });
} catch (err) {
  if (isSmsValidationError(err)) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_PARAM', message: err.message } },
      { status: 400 },
    );
  }
  logger.error('sms template list failed', err);
  return NextResponse.json(
    { success: false, error: { code: 'INTERNAL_ERROR', message: 'The request could not be processed.' } },
    { status: 500 },
  );
}
```

## UI usage

```tsx
import { SmsAdminProvider, SmsSendForm } from '@withwiz/sms-admin/components';

<SmsAdminProvider
  config={{
    fetcher: adminFetch,
    onUploadImage,
    resolveImageUrl: variantUrl,
    notify: { success: toast.success, warning: toast.warning, error: toast.error },
  }}
>
  <SmsSendForm
    // ClassRecipientPicker is only an example; the package does not provide it.
    // Plug whichever recipient selection screen your project uses into the recipientPicker slot.
    recipientPicker={(onAddRecipients) => <ClassRecipientPicker onAdd={onAddRecipients} />}
    source="briefing"
    onNavigateToHistory={() => router.push('/admin/sms/history')}
    onNavigateToTemplates={() => router.push('/admin/sms/templates')}
  />
</SmsAdminProvider>
```

The `config` object of `SmsAdminProvider` (`SmsAdminUiConfig`) takes the following options.

| Option | Description | Default |
|--------|-------------|---------|
| `basePath` | Base path of the SMS API group | `/api/admin/sms` |
| `fetcher` | A fetch function carrying the authentication headers (an `adminFetch`-style function) | Required |
| `onUploadImage` | Image upload function. It returns the public URL of the uploaded image | - |
| `resolveImageUrl` | Rule that builds variant image URLs | Falls back to the original URL when not injected |
| `notify` | `success` / `warning` / `error` notification functions | Notifications are skipped when not injected |
| `recipientStorageKey` | The `sessionStorage` key holding recipients carried over from another screen. `SmsSendForm` reads it once on the first render and then clears it | `sms_recipients` |

### Components

| Component | Description |
|-----------|-------------|
| `SmsAdminProvider` | Injects the configuration into the components below it. Read it with the `useSmsAdminConfig` hook |
| `SmsSendForm` | Send form covering recipient input, template application and image upload |
| `RecipientList` | List for adding and removing recipients |
| `TemplateSelector` | Loading and saving templates |
| `SmsDetailView` | Detail view of a sent message |

`formatDateTime(value: string | Date | null | undefined): string` is not a component, but it is exported from the same subpath (`@withwiz/sms-admin/components`). A consuming project uses it when it wants the date notation of its admin screens (`YYYY-MM-DD HH:mm:ss`) to match the one used inside the package components.

The props of `SmsSendForm` are the following.

| Prop | Description |
|------|-------------|
| `recipientPicker` | A project-specific recipient selection screen, such as a class-level picker. It calls `onAddRecipients` to hand the selection to the form |
| `onSent` | Called with the `messageId` once the send finishes. Navigation is left to the consuming side |
| `source` | Identifier of the screen that triggered the send |
| `onNavigateToHistory` | Called when the top delivery history button is clicked. The button is not rendered when this prop is omitted |
| `onNavigateToTemplates` | Called when the top template management button is clicked. The button is not rendered when this prop is omitted |

`SmsDetailView` takes a `messageId` and an optional `onBack` callback.

```tsx
import { SmsDetailView } from '@withwiz/sms-admin/components';

<SmsDetailView messageId={message.id} onBack={() => router.push('/admin/sms/history')} />
```

## Constants

Static values shared by the service layer, the UI components and the consuming project's route handlers are exported from their own entry point. It holds plain values only, with no server-only code and no `"use client"` directive, so a route handler and a client component can both import from it.

```typescript
import { MAX_PAGE_SIZE, SMS_ENDPOINTS } from '@withwiz/sms-admin/constants';

// A route handler can clamp its page size with the same bound the service enforces,
// and build its path from the same segment the components request.
const limit = Math.min(Number(searchParams.get('limit')) || 20, MAX_PAGE_SIZE);
```

| Constant | Value | Used for |
|----------|-------|----------|
| `DEFAULT_BASE_PATH` | `/api/admin/sms` | Base path applied when `SmsAdminUiConfig.basePath` is omitted |
| `SMS_ENDPOINTS` | `{ send, remain, templates, detail(id) }` | Endpoint segments appended to the base path |
| `DEFAULT_RECIPIENT_STORAGE_KEY` | `sms_recipients` | sessionStorage key applied when `recipientStorageKey` is omitted |
| `LMS_MAX_BYTES` / `SUBJECT_MAX_BYTES` | `2000` / `40` | Byte limits of an LMS or MMS body and subject |
| `MAX_CONTENT_BYTES` | per message type | Body limit per type. The SMS entry reuses `SMS_MAX_BYTES` from `@withwiz/sms-core`, so the 90-byte limit stays defined in one place |
| `DEFAULT_PAGE_SIZE` / `MAX_PAGE_SIZE` | `20` / `200` | Default page size, and the upper bound the template service enforces |
| `REMAIN_LOW_THRESHOLD` / `REMAIN_WARN_THRESHOLD` | `100` / `1000` | Thresholds at which the remaining quota badge changes color |
| `PHONE_INPUT_MAX_LENGTH` | `13` | `maxLength` of the phone number input |
| `ALLOWED_IMAGE_MIME` / `ALLOWED_IMAGE_ACCEPT` | `image/jpeg`, `image/jpg` | MIME types the send form accepts, and the same list in the form an `accept` attribute takes |

The root entry point re-exports these as well, but it is server-only. A client component must import them from `@withwiz/sms-admin/constants`.

## License

MIT
