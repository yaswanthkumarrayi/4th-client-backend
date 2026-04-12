# 🔍 SMTP Connectivity Debug Guide

**Purpose**: Diagnose whether Render is blocking SMTP connections to Gmail

**Status**: ✅ Implemented and ready for testing

---

## 📋 What Was Added

### New File: `src/utils/smtpTest.js`

A temporary debugging utility that:
- Tests connection to `smtp.gmail.com` on ports **587** and **465**
- Uses Node.js `net` module for low-level socket testing
- Tests both ports in parallel
- Has 5-second timeout for each port
- Reports clear results in logs

### Modified File: `src/index.js`

Added two changes:
1. **Line 15**: Import the SMTP test utility
2. **Lines 233-236**: Run the test after server startup (non-blocking)

---

## 🚀 How It Works

### When Server Starts

```
Server startup sequence:
1. Firebase initialized
2. MongoDB connected
3. Express configured
4. Routes registered
5. Server listening on port 5000
6. ← SMTP test runs here (non-blocking)
```

### What The Test Does

```javascript
for each port (587, 465):
  - Create TCP socket
  - Try to connect to smtp.gmail.com
  - Set 5-second timeout
  - If connected → SUCCESS
  - If timeout → RENDER LIKELY BLOCKING
  - If error → CONNECTION ERROR
```

### Example Log Output

**If Ports Are Open:**
```
📧 === SMTP CONNECTIVITY TEST (DEBUG) ===
🔍 Testing smtp.gmail.com on ports: 587, 465
⏱️  Timeout: 5000ms per port

✅ Port 587: ✅ Connected to smtp.gmail.com:587
✅ Port 465: ✅ Connected to smtp.gmail.com:465

📊 SMTP Test Summary:
✅ At least one SMTP port is reachable
   → Render is NOT blocking SMTP connections
   → Check email configuration (credentials, from address, etc.)
======================================
```

**If Ports Are Blocked:**
```
📧 === SMTP CONNECTIVITY TEST (DEBUG) ===
🔍 Testing smtp.gmail.com on ports: 587, 465
⏱️  Timeout: 5000ms per port

❌ Port 587: Connection timeout on port 587 (Render may be blocking this port)
❌ Port 465: Connection timeout on port 465 (Render may be blocking this port)

📊 SMTP Test Summary:
❌ No SMTP ports are reachable
   → Render may be blocking SMTP connections
   → Consider switching to API-based email service (e.g., Resend)
======================================
```

---

## 🧪 Testing on Render

### Step 1: Deploy Code
```bash
git add .
git commit -m "Add SMTP connectivity test"
git push
# Render auto-deploys
```

### Step 2: Check Logs
```
Render Dashboard → Backend Service → Logs
```

Look for section:
```
📧 === SMTP CONNECTIVITY TEST (DEBUG) ===
```

### Step 3: Interpret Results

| Result | Meaning | Action |
|--------|---------|--------|
| ✅ Connected to both ports | Ports open | Check email config (credentials, from address) |
| ✅ Connected to at least 1 port | Partial connectivity | One port works, try that one |
| ❌ Connection timeout both ports | Likely blocked by Render | Switch to API-based service (Resend) |
| ❌ Connection error | Network issue | Verify SMTP credentials and settings |

---

## 📊 How to Debug Email Issues

### Scenario 1: Ports Open, Emails Not Sending

**Test shows**: ✅ Connection successful
**Problem**: Configuration or credential issue

**Check**:
1. ✓ Email credentials (username/password)
2. ✓ From address format
3. ✓ Environment variables set correctly
4. ✓ Email service logs for specific errors

### Scenario 2: Ports Blocked

**Test shows**: ❌ Connection timeout
**Problem**: Render blocking SMTP

**Solution**: Switch to API-based email service (Resend)
- See: `RESEND_MIGRATION_COMPLETE.md` in backend folder
- No SMTP needed
- 1 API key instead of credentials
- Proven to work on Render

### Scenario 3: Mixed Results

**Test shows**: ✅ Port 587 works, ❌ Port 465 blocked

**Action**: Use the working port in email configuration

---

## 🔧 Code Details

### File: `src/utils/smtpTest.js`

**Key Functions**:
```javascript
testSmtpPort(host, port)  // Test single port, return Promise
runSmtpTest()              // Run all tests, log results
```

**Key Features**:
- Non-blocking (uses Promises/async)
- No crashes if connection fails
- Clear, color-coded output
- Catches all error types

**Timeout Handling**:
```javascript
- 5 second timeout per port
- If timeout: assumes port blocked
- Cleans up socket connection
- Returns clear message
```

**Error Handling**:
```javascript
- Try/catch wraps entire test
- Returns results array even if errors occur
- Logs errors but doesn't crash server
```

---

## ⚙️ Integration Details

### Why Non-Blocking?

```javascript
// Non-blocking pattern used:
runSmtpTest().catch(err => {
  console.error('SMTP test error:', err.message);
});
// Server doesn't wait for this to complete
```

This means:
- ✅ Server starts immediately (no delay)
- ✅ Test runs in background
- ✅ No impact on performance
- ✅ Logs appear within 5 seconds

### No Impact on Routes

All existing routes, controllers, and business logic are unchanged:
- ✅ Orders API works normally
- ✅ Admin APIs work normally
- ✅ Email sending works normally
- ✅ Payment processing works normally
- ✅ No performance impact

---

## 🗑️ How to Remove Later

When debugging is complete, remove the test in 2 steps:

### Step 1: Remove Import (line 15 of src/index.js)
```javascript
// DELETE THIS LINE:
import { runSmtpTest } from './utils/smtpTest.js';
```

### Step 2: Remove Test Execution (lines 233-236 of src/index.js)
```javascript
// DELETE THESE LINES:
// Run SMTP connectivity test (non-blocking, for debugging)
runSmtpTest().catch(err => {
  console.error('SMTP test encountered an error:', err.message);
});
```

### Step 3: Optional - Delete File
```bash
# Can optionally delete:
rm backend/src/utils/smtpTest.js
```

Then:
```bash
git add .
git commit -m "Remove SMTP debug utility"
git push
```

---

## 🎯 Troubleshooting The Test Itself

### Issue: Test Hangs or Takes Too Long

**Cause**: 5-second timeout per port (normal)
**Expected**: Test completes in 5-10 seconds total
**Check**: Wait for complete output before checking logs

### Issue: Test Not Running

**Check**:
1. Did you deploy code? (git push)
2. Wait for Render build to complete (2-3 min)
3. Check Render logs section
4. Look for "SMTP CONNECTIVITY TEST"

### Issue: See Network Error Code

**Common Codes**:
- `ECONNREFUSED` → Connection refused (port closed)
- `ETIMEDOUT` → Timeout (likely port blocked)
- `ENETUNREACH` → Network unreachable (routing issue)

**Action**: All errors indicate Render blocking SMTP

---

## 📝 Technical Specifications

### What Gets Tested
```
Host: smtp.gmail.com
Ports: 587 (STARTTLS), 465 (TLS/SSL)
Timeout: 5 seconds
Parallel: Both ports tested simultaneously
```

### Why These Ports?
- **Port 587**: Most common SMTP submission port
- **Port 465**: Alternative TLS port
- **Gmail**: Most common SMTP provider

### Why Node.js net module?
- ✅ Low-level TCP socket testing
- ✅ No dependencies
- ✅ Works in any Node.js environment
- ✅ Doesn't require SMTP library

---

## 🔐 Security Notes

### Data Privacy
- ✅ Test is READ-ONLY (no data sent)
- ✅ No credentials transmitted
- ✅ No actual email sent
- ✅ Just checks if port is reachable

### Safe to Run
- ✅ No side effects
- ✅ No state changes
- ✅ No data modification
- ✅ Socket closed immediately

---

## 📊 Next Steps After Testing

### If Ports Are Open (✅)
1. Check email credentials in .env
2. Verify from address format
3. Test with actual email send
4. Check email service logs
5. Enable verbose logging if needed

### If Ports Are Blocked (❌)
1. Consider switching to Resend API
2. See: `RESEND_MIGRATION_COMPLETE.md`
3. Migration takes ~5 minutes
4. No code changes needed (just config)
5. Proven to work on Render

---

## 📞 Questions?

This is a temporary debugging tool. When no longer needed:
- Simply remove the import and function call
- Delete the file (optional)
- No cleanup needed

---

## ✅ Summary

**What**: SMTP connectivity debug utility
**When**: Runs after server startup
**Where**: Logs appear in Render logs
**Why**: Diagnose if Render blocks SMTP
**How to Use**: Deploy, check logs, interpret results
**How to Remove**: Delete 2 lines from index.js
**Impact**: None (non-blocking, read-only)

---

**Debug wisely! 🔍📧**
