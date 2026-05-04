# Google Maps API Setup Guide for Tiffsy

Complete step-by-step guide to set up Google Maps Geocoding API for precise location detection.

---

## Why Google Maps API?

- ✅ **Most accurate** for Indian addresses (street-level precision)
- ✅ **Free tier:** 28,500 requests/month (~950/day)
- ✅ **Industry standard** used by Zomato, Swiggy, Uber, etc.
- ✅ **Better than OpenStreetMap** for India

---

## Step 1: Create Google Cloud Project

### 1.1 Go to Google Cloud Console
Visit: [https://console.cloud.google.com/](https://console.cloud.google.com/)

### 1.2 Sign in
- Use your Google account (Gmail)
- Accept Terms of Service if prompted

### 1.3 Create New Project
1. Click the **project dropdown** at the top (next to "Google Cloud")
2. Click **"NEW PROJECT"** button
3. Enter project details:
   - **Project name:** `Tiffsy-App` (or any name you prefer)
   - **Organization:** Leave as "No organization" (or select if you have one)
4. Click **"CREATE"**
5. Wait for project creation (takes ~10-30 seconds)
6. Select your new project from the dropdown

---

## Step 2: Enable Geocoding API

### 2.1 Navigate to APIs & Services
1. Click the **☰ hamburger menu** (top left)
2. Go to: **APIs & Services → Library**

### 2.2 Search for Geocoding API
1. In the search box, type: `Geocoding API`
2. Click on **"Geocoding API"** from results (by Google Maps Platform)

### 2.3 Enable the API
1. Click the blue **"ENABLE"** button
2. Wait for activation (takes ~5-10 seconds)
3. You'll see "API enabled" confirmation

---

## Step 3: Create API Key

### 3.1 Navigate to Credentials
1. Click **☰ hamburger menu** → **APIs & Services → Credentials**
2. Or click **"Credentials"** in the left sidebar

### 3.2 Create Credentials
1. Click **"+ CREATE CREDENTIALS"** at the top
2. Select **"API key"** from the dropdown
3. A popup appears showing your new API key
4. **IMPORTANT:** Copy this key immediately!

Example API key format:
```
AIzaSyAKlXJ7qwE67VsYZ9x0Ry_qYWLRY0tiBgg
```

### 3.3 Save Your API Key
**Copy and save this key securely** - you'll need it for the next steps.

---

## Step 4: Restrict API Key (Security - IMPORTANT!)

**Why?** Unrestricted API keys can be stolen and abused, leading to unexpected charges.

### 4.1 Edit API Key
1. After creating the key, click **"EDIT API KEY"** (or find it in Credentials list)
2. You'll see the "Edit API key" page

### 4.2 Set Application Restrictions

#### Option A: For Production (Recommended)
**Restrict to Mobile Apps:**

1. Under **"Application restrictions"**, select:
   - ☑️ **"Android apps"** (if you have Android app)
   - ☑️ **"iOS apps"** (if you have iOS app)

2. Click **"Add an item"** under each platform:

   **For Android:**
   - Package name: `com.tiffsy.app` (or your actual package name)
   - SHA-1 certificate fingerprint: (Get from your keystore)

   **For iOS:**
   - Bundle identifier: `com.tiffsy.app` (or your actual bundle ID)

3. Click **"SAVE"**

#### Option B: For Development/Testing (Temporary)
**No restrictions:**
- Select **"None"** under Application restrictions
- ⚠️ **Remember to add restrictions before production!**

### 4.3 Set API Restrictions
1. Under **"API restrictions"**, select **"Restrict key"**
2. Check **only**: ☑️ **Geocoding API**
3. Click **"SAVE"**

---

## Step 5: Enable Billing (Required)

**Important:** Google requires billing to be enabled even for free tier usage. You won't be charged unless you exceed the free quota.

### 5.1 Go to Billing
1. Click **☰ hamburger menu** → **Billing**
2. Click **"LINK A BILLING ACCOUNT"**

### 5.2 Create Billing Account
1. Click **"CREATE BILLING ACCOUNT"**
2. Fill in your information:
   - Country
   - Payment method (Credit/Debit card)
   - Billing address
3. Click **"START MY FREE TRIAL"** or **"SUBMIT AND ENABLE BILLING"**

### 5.3 Set Budget Alert (Optional but Recommended)
1. Go to **Billing → Budgets & alerts**
2. Click **"CREATE BUDGET"**
3. Set budget amount: e.g., `$10/month`
4. Set alert threshold: `50%, 90%, 100%`
5. Enter your email for notifications
6. Click **"FINISH"**

**Free Tier Limits:**
- $200 free credit for 90 days (new accounts)
- After trial: 28,500 Geocoding requests/month **FREE**
- Cost after free tier: $5 per 1000 requests

---

## Step 6: Add API Key to Your App

### 6.1 Open Location Service File
File: `src/services/location.service.ts`

### 6.2 Replace API Key
Find this line (around line 156):
```typescript
const GOOGLE_API_KEY = 'AIzaSyAKlXJ7qwE67VsYZ9x0Ry_qYWLRY0tiBgg';
```

Replace with your actual API key:
```typescript
const GOOGLE_API_KEY = 'YOUR_NEW_API_KEY_HERE';
```

### 6.3 Save the File

---

## Step 7: Test Your Setup

### 7.1 Restart Your App
```bash
# Stop the running app
# Then restart:
npm run android
# or
npm run ios
```

### 7.2 Test Location Feature
1. Open the app
2. Grant location permission
3. Go to **My Addresses** screen
4. Click **"Use Current Location"**
5. Wait 5-10 seconds

### 7.3 Check Results
You should see:
- ✅ Detailed street address
- ✅ Locality/area name
- ✅ City name
- ✅ State
- ✅ Pincode

### 7.4 Check Console Logs
Look for this in your console:
```
[LocationService] Google Geocoding result: {...}
[LocationService] Parsed address: {
  addressLine1: "123, MG Road",
  locality: "Vijay Nagar",
  city: "Indore",
  state: "Madhya Pradesh",
  pincode: "452010"
}
```

---

## Common Issues & Solutions

### Issue 1: "REQUEST_DENIED" Error

**Error Message:**
```
Google API key is invalid or not configured properly
```

**Possible Causes & Solutions:**

1. **API Key Not Enabled:**
   - Go to: APIs & Services → Enabled APIs & Services
   - Verify "Geocoding API" is listed
   - If not, go back to Step 2 and enable it

2. **Billing Not Enabled:**
   - Go to: Billing section
   - Ensure billing account is linked
   - Complete Step 5

3. **Wrong API Restrictions:**
   - Go to: Credentials → Edit your API key
   - Under "API restrictions", ensure "Geocoding API" is checked
   - Click "SAVE"

4. **API Key Incorrect:**
   - Copy the API key again from Google Cloud Console
   - Paste it carefully in `location.service.ts` (no extra spaces)

---

### Issue 2: API Key Works but App Bundle Restriction Fails

**Error:** Works in development but not in production build

**Solution:**
1. Get your app's SHA-1 certificate fingerprint:

   **For Android Debug:**
   ```bash
   cd android
   ./gradlew signingReport
   ```
   Look for: `SHA1: XX:XX:XX:...`

   **For Android Release:**
   ```bash
   keytool -list -v -keystore /path/to/your/keystore.jks
   ```

2. Add this SHA-1 to your API key restrictions in Google Cloud Console

3. For iOS: Use your actual Bundle Identifier from Xcode

---

### Issue 3: "OVER_QUERY_LIMIT" Error

**Error:** Too many requests

**Solutions:**
1. Check your usage: APIs & Services → Dashboard → Geocoding API
2. If exceeded free tier, consider:
   - Caching location results (already implemented)
   - Adding delay between requests
   - Upgrading your plan

---

### Issue 4: No Pincode Detected

**Error:** Location detected but pincode is empty

**Solution:**
This happens in remote areas. The API is working correctly. Options:
1. User manually enters pincode
2. Try moving to a different location
3. Use less precise but available city/state data

---

## Best Practices

### 1. Security
✅ **DO:**
- Restrict API key to specific APIs (Geocoding only)
- Restrict to your app's bundle ID/package name
- Keep API key in environment variables (production)
- Never commit API key to public GitHub repo

❌ **DON'T:**
- Use unrestricted API keys in production
- Share API key publicly
- Hard-code key in client-side code (but okay for mobile apps)

### 2. Cost Optimization
✅ **DO:**
- Cache location results (already implemented)
- Only fetch location when needed
- Set billing alerts
- Monitor usage regularly

❌ **DON'T:**
- Fetch location on every screen load
- Make unnecessary reverse geocoding calls
- Ignore billing notifications

### 3. User Experience
✅ **DO:**
- Show loading states (already implemented)
- Provide manual entry fallback (already implemented)
- Cache last known location (already implemented)
- Handle errors gracefully (already implemented)

---

## Environment Variables (Production Recommendation)

For production, don't hard-code the API key. Use environment variables:

### 1. Install react-native-config
```bash
npm install react-native-config
```

### 2. Create .env file
```bash
# .env
GOOGLE_MAPS_API_KEY=AIzaSyAKlXJ7qwE67VsYZ9x0Ry_qYWLRY0tiBgg
```

### 3. Add .env to .gitignore
```bash
echo ".env" >> .gitignore
```

### 4. Use in code
```typescript
import Config from 'react-native-config';

const GOOGLE_API_KEY = Config.GOOGLE_MAPS_API_KEY;
```

---

## Monitoring Usage

### Check API Usage
1. Go to: Google Cloud Console
2. Navigate to: APIs & Services → Dashboard
3. Click on **"Geocoding API"**
4. View metrics:
   - Requests per day
   - Errors
   - Latency

### Set Up Alerts
1. Go to: Billing → Budgets & alerts
2. Create budget alerts at 50%, 90%, 100%
3. Add your email for notifications

---

## Cost Calculator

**Free Tier:** 28,500 requests/month

**After Free Tier:** $5 per 1,000 requests

**Example Usage:**
- 100 users/day × 2 location requests = 200 requests/day
- 200 × 30 days = 6,000 requests/month
- **Cost:** $0 (within free tier)

**Estimated Monthly Cost:**
- 0-28,500 requests: **FREE**
- 50,000 requests: **~$1.07**
- 100,000 requests: **~$3.58**

---

## Support Links

- [Google Maps Platform Documentation](https://developers.google.com/maps/documentation/geocoding)
- [Geocoding API Pricing](https://mapsplatform.google.com/pricing/)
- [API Key Best Practices](https://developers.google.com/maps/api-security-best-practices)
- [Google Cloud Console](https://console.cloud.google.com/)

---

## Quick Checklist

Before going to production, ensure:

- [ ] API key created
- [ ] Geocoding API enabled
- [ ] Billing account linked
- [ ] Budget alerts configured
- [ ] API key restricted to Geocoding API only
- [ ] API key restricted to your app bundle ID
- [ ] API key added to location.service.ts
- [ ] Tested on physical device
- [ ] Location works correctly
- [ ] Error handling tested
- [ ] .env file in .gitignore (if using env variables)

---

## Need Help?

If you encounter issues:

1. **Check API Status:**
   - Go to: [Google Cloud Status Dashboard](https://status.cloud.google.com/)

2. **Review Logs:**
   - Check your app's console logs
   - Check Google Cloud Console → Logging

3. **Common Error Codes:**
   - `REQUEST_DENIED` → Billing or API not enabled
   - `OVER_QUERY_LIMIT` → Exceeded quota
   - `INVALID_REQUEST` → Wrong parameters
   - `ZERO_RESULTS` → No address found at location
   - `UNKNOWN_ERROR` → Server error, try again

---

## Summary

You now have:
- ✅ Google Maps API configured
- ✅ Geocoding API enabled
- ✅ API key secured with restrictions
- ✅ Billing set up with alerts
- ✅ Location feature working with high accuracy

**Total Setup Time:** ~10-15 minutes
**Monthly Cost (typical app):** $0 (within free tier)
**Accuracy:** Street-level (same as Zomato/Swiggy)

Your app now has **production-ready location services**! 🎉
