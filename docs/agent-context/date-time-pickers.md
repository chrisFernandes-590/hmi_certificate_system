# Shared date and time pickers

`apps/web/src/components/date-time/` is the canonical interactive date selection UI. Import `DatePicker`, `DateTimePicker`, or `DateRangePicker` from `@/components/date-time` for new fields. Keep date formatting for read-only labels in the consuming feature.

## Values and usage

- `DatePicker` takes and returns `YYYY-MM-DD`; this is a calendar date and is not converted to UTC.
- `DateTimePicker` takes and returns a browser-local `YYYY-MM-DDTHH:mm` string. Existing event forms turn that local value into an ISO instant only at submit, preserving the API's ISO timestamp contract.
- `DateRangePicker` takes and returns `{ start, end, includeTime, timeZone }`; endpoints are nullable. The end can be selected after the start, and reverse selection swaps endpoints. `includeTime` is a presentation/entry option; the component does not convert an existing endpoint to another timezone.
- Props include controlled (`value`/`onChange`) or uncontrolled (`defaultValue`) state, `name`, `id`, `placeholder`, `disabled`, `min`, `max`, `weekStartsOn` (Monday by default), and `locale`.
- Min/max values are date strings (`YYYY-MM-DD`) or date-time strings beginning with that date. Disabled-date callbacks and event indicators are not implemented yet.

The popover provides month/year navigation, Today/Tomorrow/Next week/In one month presets, typed entry, date bounds, Escape dismissal, day keyboard navigation, theme tokens, and a mobile/short-screen bottom sheet. Desktop placement flips above or below the trigger to fit the viewport and stays on that side while its contents change size. Typed dates include ISO, numeric dates (locale determines month/day order; the app locale is the default), month-name dates, `today`, `tomorrow`, `next <weekday>`, and `in N days`. Invalid input remains visible with an error while editing. Time entry uses focusable hour/minute/period spinbuttons, 12/24-hour display, quick time chips, paste parsing, and arrow-key adjustment.

Timezone selection is not exposed because the application has no timezone preference or timezone contract; date-time values continue to represent browser-local entry converted to UTC on event form submission. Natural-language parsing is intentionally limited to the documented patterns and does not use an added parsing dependency. Focus trapping and restoration, live timezone conversion, relative/date-format preferences, touch drag gestures, date-specific disabled callbacks, event dots, and range-hover preview are future extensions. End time ordering is surfaced inline in the range picker and corrected on blur when both endpoints are on the same day; event forms retain their existing submit-time validation.

Run focused date parsing tests with `node --test test/date-picker-utils.test.js` from `apps/web`; this uses Node's built-in test runner and adds no dependency.

## Migration audit

- Migrated event create/edit start and end fields in `features/events/events.tsx` to `DateTimePicker`. Hidden named form fields retain `startDate` and `endDate`; the existing validation, date-order guard, and ISO conversion remain at submit.
- Repository source audit found no other interactive date/time inputs or third-party date pickers. Event/certificate timestamps elsewhere are read-only labels or sorting logic and remain unchanged.
- `DatePickerDemo.tsx` is available at the development-only `/__picker-preview` route; it is not included in production routes.
