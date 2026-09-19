// This entry point (`@withwiz/sms-admin`) is server-only. It exports Prisma-backed
// service factories, so importing even a single value here from a client component
// drags the whole service layer into the bundle. Use `@withwiz/sms-admin/components`
// when you need the UI and `@withwiz/sms-admin/types` when you only need types. The
// sibling `sms-core` package hit the same problem, so it is spelled out here.
export * from './constants';
export * from './types';
export * from './services';
export { createSmsAdmin, type SmsAdmin, type SmsAdminConfig } from './facade/create-sms-admin';
