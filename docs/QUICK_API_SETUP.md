# Quick Google Maps API Setup (5 Minutes)

## TL;DR - Fast Setup

### 1. Create Project & Enable API (2 min)
```
1. Go to: console.cloud.google.com
2. Create new project: "Tiffsy-App"
3. Enable "Geocoding API"
4. Create API key → Copy it
```

### 2. Enable Billing (2 min)
```
1. Go to: Billing section
2. Link billing account (credit card required)
3. You get $200 free credit + 28,500 free requests/month
4. Set budget alert at $10/month
```

### 3. Add to App (1 min)
```typescript
// In: src/services/location.service.ts (line 156)
const GOOGLE_API_KEY = 'PASTE_YOUR_KEY_HERE';
```

### 4. Test It
```bash
# Open the test file in browser:
test-google-api.html

# Or test in app:
npm run android
# Go to: My Addresses → Use Current Location
```

---

## Current Issue: "REQUEST_DENIED"

### Most Common Cause: Billing Not Enabled

**Fix:**
1. Go to: [console.cloud.google.com/billing](https://console.cloud.google.com/billing)
2. Click "LINK A BILLING ACCOUNT"
3. Add credit/debit card
4. Submit

**Note:** You won't be charged. Free tier is 28,500 requests/month.

---

## Verification Checklist

Open [console.cloud.google.com](https://console.cloud.google.com) and verify:

- [ ] **Project created** (top dropdown shows "Tiffsy-App")
- [ ] **Geocoding API enabled** (APIs & Services → Library → Search "Geocoding API" → Should show "API enabled")
- [ ] **API key created** (Credentials → Should see your key)
- [ ] **Billing enabled** (Billing → Should show linked account)
- [ ] **Key in app** (location.service.ts line 156 has your key)

---

## Test Your API Key

### Option 1: Browser Test (Recommended)
1. Open `test-google-api.html` in browser
2. Paste your API key
3. Click "Test API"
4. Should see: ✅ SUCCESS with address details

### Option 2: Command Line Test
```bash
# Replace YOUR_KEY with your actual API key
curl "https://maps.googleapis.com/maps/api/geocode/json?latlng=22.7196,75.8577&key=YOUR_KEY"

# Should return JSON with status: "OK"
```

### Option 3: App Test
```bash
npm run android
# Go to My Addresses → Click "Use Current Location"
# Should auto-fill form with your address
```

---

## Error Messages & Quick Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `REQUEST_DENIED` | Billing not enabled | Enable billing at console.cloud.google.com/billing |
| `REQUEST_DENIED` | API not enabled | Enable "Geocoding API" in API Library |
| `OVER_QUERY_LIMIT` | Exceeded quota | Wait for reset or upgrade plan |
| `INVALID_REQUEST` | Wrong API key | Copy key again from Credentials |
| `ZERO_RESULTS` | Remote location | Normal - user enters manually |

---

## Important Notes

### Free Tier
- **First 90 days:** $200 free credit
- **Every month:** 28,500 free Geocoding requests
- **After free tier:** $5 per 1,000 requests
- **Typical app usage:** 100-1000 requests/month = FREE

### Security
For development: No restrictions (fastest setup)
For production: Restrict to:
- API: Geocoding API only
- App: Your Android package name / iOS bundle ID

### Getting Package Name
**Android:**
```bash
# Open: android/app/build.gradle
# Find: applicationId "com.tiffsy.app"
```

**iOS:**
```bash
# Open Xcode → Select target → General → Bundle Identifier
```

---

## Still Not Working?

### Step-by-Step Debug

1. **Verify API Key is Correct**
   ```
   • Length: 39 characters
   • Starts with: AIza
   • No extra spaces or quotes
   ```

2. **Check API Status**
   - Go to: APIs & Services → Dashboard
   - Click: Geocoding API
   - Should show: "API enabled"

3. **Check Billing**
   - Go to: Billing
   - Should show: Account linked
   - Status: Active

4. **Wait 5 Minutes**
   - New API keys take 1-5 minutes to activate
   - Create key → Wait → Try again

5. **Create New Key**
   - Sometimes keys are buggy
   - Create a fresh one
   - Use new key in app

6. **Remove All Restrictions**
   - Edit API key
   - Set Application restrictions: None
   - Set API restrictions: None
   - Save → Wait 2 minutes → Test

---

## Contact Info

If stuck after trying all above:

1. **Check API Status Page:**
   [status.cloud.google.com](https://status.cloud.google.com/)

2. **Review Quota:**
   APIs & Services → Geocoding API → Quotas

3. **Check Logs:**
   Google Cloud Console → Logging

4. **Stack Overflow:**
   Search: "Google Geocoding API REQUEST_DENIED"

---

## Success Indicators

You'll know it's working when:

✅ `test-google-api.html` shows: SUCCESS with full address
✅ Console logs show: `[LocationService] Google Geocoding result: {...}`
✅ App auto-fills: Street, locality, city, state, pincode
✅ Address looks like: "123 MG Road, Vijay Nagar, Indore, Madhya Pradesh, 452010"

---

## Time Required

- **Setup:** 5 minutes
- **Propagation:** 1-5 minutes (waiting for API key activation)
- **Testing:** 2 minutes
- **Total:** ~10 minutes

---

## Cost Estimate

**Your Usage (estimated):**
- App startup: 1 request
- Use Current Location button: 1 request
- Average: 2-3 requests per user session

**Monthly Cost:**
- 100 users × 3 requests = 300 requests/month = **$0**
- 1,000 users × 3 requests = 3,000 requests/month = **$0**
- 10,000 users × 3 requests = 30,000 requests/month = **$0.08** (~₹7)

You'll stay in free tier for a long time! 🎉

---

## Next Steps

1. ✅ Follow 5-minute setup above
2. ✅ Test with `test-google-api.html`
3. ✅ Test in app with "Use Current Location"
4. ✅ Done! Location feature is ready

See [GOOGLE_MAPS_API_SETUP.md](GOOGLE_MAPS_API_SETUP.md) for detailed guide.
