# Milk Ledger Feature Notes

## Ledger Model

Milk Ledger stores customers, transactions, rates, account settings, business profile, and activity logs in local app storage. Capacitor wraps the web app in an Android shell.

## Party Types

- Purchase supplier: people/businesses you buy milk from.
- Sale customer: people/businesses you sell milk/items to.

## Transaction Types

- Purchase milk: category, type, shift, quantity, sample weight, rate, amount, status.
- Sale item: item catalog, quantity, rate, amount, status.
- Money transaction: credit/debit adjustment or payment note.

## Status Rules

- Paid: settled immediately; does not affect statement closing balance.
- Credit: adds to balance.
- Udhaar/debit: subtracts from balance.

## Date Ranges

Dashboard and statements support date ranges. Statement opening balance carries forward all prior credit/debit activity before the selected start date.

## Export And Sharing

The app generates:

- CSV file
- PDF file
- JPEG statement image
- Plain text statement
- JSON backup

Files are written to Android cache through Capacitor Filesystem, then shared through the native Android share sheet.

## Backups

Backup targets:

- Local share/export
- Google Drive through Android share
- OneDrive through Android share

Auto-backup preferences are stored in account settings. `Every entry` creates a local cache backup after entry changes. Fixed-time scheduling is recorded as a preference and needs a native Android background worker for unattended production scheduling.

## Activity Log

The app records recent activity with timestamps, including:

- Party added
- Opening balance changed
- Transaction added/updated/deleted
- Rate changes
- Profile/settings changes
- Backup creation

The log is capped to recent events to avoid unbounded local storage growth.
