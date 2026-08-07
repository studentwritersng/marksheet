# 12 — Notifications

## 1. Purpose

Notifications deliver event-driven messages **in-app** and optionally via **email, WhatsApp, and SMS** to staff, students, and parents. Events include exam scheduling, results publication, announcements, assignment notifications, attendance, and more.

## 2. Architecture

```
Feature server action (e.g. publish exam)
   │
   ▼  hook*Event(...) in src/lib/notifications/event-hooks.ts
NotifyStudents / enqueue
   │
   ▼
NotificationQueue (row + random 5–50s delay)
   │
   ▼
/api/notifications/process-queue  (cron / manual, 50 per run)
   │
   ▼
Delivery to channels (in-app, WhatsApp, SMS, email)
   ▼
NotificationLog (sent/failed)
```

## 3. Files

- `src/lib/notifications/actions.ts` — `notifyStudents`, enqueue helpers, per-school config actions
- `src/lib/notifications/event-hooks.ts` — `hookExamScheduled` and other event hooks
- `src/lib/notifications/provider-actions.ts` — manage `NotificationProviderConfig` (WhatsApp/SMS credentials)
- `src/lib/notifications/types.ts` — shared types
- `src/app/api/notifications/process-queue/route.ts` — the queue processor job
- `src/app/api/notifications/unread/route.ts` — unread-count endpoint for the bell (polled ~30s, 5s cache)
- `src/app/(app)/notifications`, `announcements` — UI

## 4. Models

| Model | Role |
|---|---|
| `Notification` | The record itself (in-app/sms/email), delivery status |
| `Announcement` | School announcements with target roles, sticky, publish/expiry |
| `NotificationProviderConfig` | WhatsApp/SMS provider credentials (Twilio, Africa's Talking, custom) — **secrets encrypted** via `src/lib/secrets.ts` |
| `NotificationTemplate` | Message bodies with `{{variables}}` per event type + channel |
| `NotificationQueue` | Outbound queue with randomised 5–50s scheduled delays |
| `NotificationLog` | Delivery log (sent/failed) with provider + error |
| `SchoolNotificationConfig` | Per-school SMS/WhatsApp toggles + enabled event list |

## 5. Channels & providers

- **In-app:** always (creates `Notification`, shown in the bell + `/notifications`).
- **WhatsApp / SMS:** when the school enables them in `SchoolNotificationConfig` and configures a provider. Providers include Twilio, Africa's Talking, and a custom HTTP option. Guardian phone (`Guardian.phone`) is required for WhatsApp.
- **Email:** via Nodemailer `src/lib/email/send.ts` using SMTP env vars; `enabledEvents` controls which events dispatch.

## 6. The queue processor

`/api/notifications/process-queue` (`GET`/`POST`):

- Authorised via `CRON_SECRET` bearer **or** an authenticated `platform_owner`.
- Rate-limited.
- Processes **50 notifications per run** — due items (past their random delay).
- Intended to be invoked by a scheduler (Vercel Cron, system cron) on a cadence.

## 7. Console operations

- `/console/notifications` — publish notifications platform-wide / manage.
- `/proprietor/(console)/...` and school `/settings` — per-school notification config.

## 8. Adding a new notification event

1. Add an event hook in `src/lib/notifications/event-hooks.ts` (e.g. `hookExamScheduled(...)`).
2. Call it at the relevant point in the domain server action (after the mutation + audit).
3. Add a `NotificationTemplate` for the event × channel(s).
4. Ensure the event is enabled in `SchoolNotificationConfig` and the relevant addon/channel is active.

## 9. Gotchas

- **Secrets** in `NotificationProviderConfig` are encrypted at rest — manage them via `provider-actions.ts`, never hardcode.
- **Rate/credits:** respect per-school channel toggles and provider cost; the queue's random delays avoid bursts.
- **Guardian phone required** for WhatsApp — validate on guardian creation.
- **In-memory cache** on the unread endpoint is 5s TTL — fine for a 30s poll.