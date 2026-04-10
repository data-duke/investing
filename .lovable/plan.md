

# Add "Unlimited" Share Expiration Option

## Change

Add a new expiration option that creates a share link with no expiry (or a very far future date like year 9999).

## Implementation

### 1. `src/lib/constants.ts`
Add a new option to `SHARE_EXPIRATION_OPTIONS`:
```typescript
{ label: 'Unlimited', value: -1 },
```
Using `-1` as a sentinel value to indicate "no expiration."

### 2. `src/components/ShareDialog.tsx`
Update the expiration calculation (around line 83-84):
```typescript
const hours = parseInt(expirationHours);
const expiresAt = hours === -1
  ? new Date('9999-12-31T23:59:59Z')
  : new Date(Date.now() + hours * 3600000);
```

### 3. `src/components/ManageSharesDialog.tsx`
Update the `isExpired` check and expiration display to handle the far-future date gracefully — show "Never" instead of "Expires in 7973 years."

### 4. Translation files (`en.json`, `de.json`, `sr.json`)
Add `share.never` key: "Never" / "Nie" / "Nikada"

### Files to modify
| File | Change |
|------|--------|
| `src/lib/constants.ts` | Add `{ label: 'Unlimited', value: -1 }` option |
| `src/components/ShareDialog.tsx` | Handle `-1` sentinel for far-future expiry |
| `src/components/ManageSharesDialog.tsx` | Show "Never" for unlimited links |
| `src/i18n/locales/en.json`, `de.json`, `sr.json` | Add translation keys |

