# Testing Guide - Leaderboard System Fixes

## Quick Test Suite
Comprehensive testing guide for all QA fixes implemented in the community check-in and leaderboard system.

---

## 1. Race Condition Fix Testing

### Test Case 1.1: Rapid Check-In Button Tapping
**Objective:** Verify transaction prevents duplicate check-ins

**Steps:**
1. Navigate to Community Check-In screen
2. Wait until check-in button is available
3. Rapidly tap the check-in button 5-10 times in quick succession
4. Observe the behavior

**Expected Result:**
- Only ONE check-in should be processed
- User should see success alert once
- Points/coins should only increment once
- Subsequent taps should show "Already Checked In" message

**Pass Criteria:** ✅ No duplicate check-ins regardless of tap speed

---

### Test Case 1.2: Concurrent Check-In From Multiple Devices
**Objective:** Verify transaction prevents simultaneous check-ins

**Steps:**
1. Log in with same account on 2 devices
2. Navigate to same community check-in screen on both
3. Tap check-in button simultaneously on both devices
4. Check Firestore data

**Expected Result:**
- Only one device should successfully check in
- Other device should receive "Already Checked In" error
- Only one history entry created
- Correct points/coins increment

**Pass Criteria:** ✅ Only one successful check-in recorded

---

## 2. UTC Timezone Fix Testing

### Test Case 2.1: Cross-Timezone Check-In
**Objective:** Verify check-ins use UTC, not device timezone

**Steps:**
1. Check in at 11:58 PM local time
2. Change device timezone to different timezone (e.g., +5 hours)
3. Try to check in again (should still be same UTC day)
4. Wait until next UTC day starts
5. Try check-in again

**Expected Result:**
- Cannot check in again if same UTC date
- Can check in once new UTC date starts
- Streak continues if checked in on consecutive UTC days

**Pass Criteria:** ✅ All dates calculated in UTC, device timezone changes have no effect

---

### Test Case 2.2: Streak Calculation Accuracy
**Objective:** Verify streaks work correctly across UTC midnight

**Steps:**
1. Check in at 11:59 PM UTC
2. Wait 2 minutes (past UTC midnight)
3. Check in again
4. Verify streak incremented

**Expected Result:**
- Streak increases from 1 to 2
- No streak break
- Correct multipliers applied

**Pass Criteria:** ✅ Streak increments correctly across UTC midnight

---

## 3. N+1 Query Optimization Testing

### Test Case 3.1: Leaderboard Load Performance
**Objective:** Verify batch queries reduce Firestore reads

**Steps:**
1. Open Firebase Console > Firestore > Usage tab
2. Note current read count
3. Navigate to Community Leaderboard
4. Wait for leaderboard to load
5. Check Firebase Console for new read count

**Expected Result:**
- For 50 users: ~6 reads (1 for check-ins, ~5 for users in batches of 10)
- Before fix: Would be 51 reads (1 + 50)
- 88% reduction in reads

**Pass Criteria:** ✅ Firestore reads ≤ (number_of_users / 10) + 1

---

### Test Case 3.2: Large Leaderboard Test
**Objective:** Verify optimization scales with more users

**Steps:**
1. Test with communities of different sizes:
   - 10 users: ~2 reads
   - 50 users: ~6 reads
   - 100 users: ~11 reads (if limit increased)
2. Monitor Firebase Console usage

**Expected Result:**
- Linear growth: reads ≈ (users / 10) + 1
- Old system: reads = users + 1

**Pass Criteria:** ✅ Batch optimization maintains O(n/10) complexity

---

## 4. Memory Leak Fix Testing

### Test Case 4.1: Countdown Timer Cleanup
**Objective:** Verify timer doesn't leak when navigating away

**Steps:**
1. Navigate to Check-In screen
2. Check in (or wait if already checked in today)
3. Observe countdown timer running
4. Quickly navigate back (before countdown finishes)
5. Use React DevTools to check for orphaned intervals
6. Repeat 5-10 times

**Expected Result:**
- No accumulating intervals
- Timer stops when leaving screen
- No console warnings about unmounted component updates

**Pass Criteria:** ✅ No memory leaks, timer cleaned up properly

---

### Test Case 4.2: Animation Cleanup
**Objective:** Verify animations stop on unmount

**Steps:**
1. Navigate to Check-In screen when button is available
2. Observe glowing animation
3. Rapidly navigate back and forth 10 times
4. Check DevTools for animation references
5. Monitor app performance

**Expected Result:**
- No performance degradation
- Animations stop when leaving screen
- No accumulated animation loops

**Pass Criteria:** ✅ Smooth performance, no animation leaks

---

## 5. Offline Support Testing

### Test Case 5.1: Check-In While Offline
**Objective:** Verify offline detection works

**Steps:**
1. Navigate to Check-In screen
2. Turn off WiFi and mobile data (Airplane mode)
3. Wait 2-3 seconds for NetInfo to detect
4. Try to check in

**Expected Result:**
- Alert appears: "📡 No Connection"
- Message: "Please check your internet connection and try again."
- No network request attempted
- User stays on same screen

**Pass Criteria:** ✅ Immediate offline alert, no hanging requests

---

### Test Case 5.2: Network Reconnection
**Objective:** Verify app detects reconnection

**Steps:**
1. Start app in offline mode
2. Navigate to Check-In screen (should show offline state)
3. Turn on internet connection
4. Wait 2-3 seconds
5. Try to check in

**Expected Result:**
- Check-in should work once connected
- No need to refresh or restart app
- NetInfo automatically detects connection

**Pass Criteria:** ✅ Auto-detect reconnection, check-in works

---

## 6. Error Boundary Testing

### Test Case 6.1: Component Error Handling
**Objective:** Verify ErrorBoundary catches errors gracefully

**Steps:**
1. Temporarily add this to Check-In screen:
   ```javascript
   if (someCondition) throw new Error("Test error");
   ```
2. Trigger the error condition
3. Observe error UI

**Expected Result:**
- App doesn't crash or show blank screen
- Error UI appears with:
  - Warning icon
  - "Oops! Something went wrong" title
  - Friendly message
  - "Try Again" button
  - "Go Back" button (if available)
- In dev mode: Error details shown

**Pass Criteria:** ✅ Graceful error UI, no blank screen

---

### Test Case 6.2: Error Recovery
**Objective:** Verify "Try Again" works

**Steps:**
1. Trigger test error
2. Click "Try Again" button
3. Verify component re-renders properly

**Expected Result:**
- Error boundary resets state
- Component renders normally
- App continues working

**Pass Criteria:** ✅ Successful recovery from error state

---

## 7. Input Validation Testing

### Test Case 7.1: Invalid Parameters
**Objective:** Verify validation prevents crashes

**Steps:**
1. In console or test file, try:
   ```javascript
   getUserCheckInData(null, communityId, userId);
   getUserCheckInData(db, null, userId);
   getUserCheckInData(db, communityId, null);
   getUserCheckInData(db, undefined, userId);
   ```
2. Observe error messages

**Expected Result:**
- Descriptive error thrown:
  - "Firestore instance is required"
  - "Valid communityId is required"
  - "Valid userId is required"
- No generic crashes
- Clear error messages

**Pass Criteria:** ✅ All invalid inputs caught with clear errors

---

## 8. XSS Prevention Testing

### Test Case 8.1: HTML in Display Names
**Objective:** Verify display names sanitized

**Steps:**
1. Create test user with malicious display name:
   ```
   <script>alert('XSS')</script>User
   <img src=x onerror=alert('XSS')>
   ```
2. Have this user check in
3. View them on leaderboard
4. Inspect rendered HTML

**Expected Result:**
- Display name shows as plain text
- No script tags rendered
- No XSS executed
- Shows: "User" or "Unknown User"

**Pass Criteria:** ✅ All HTML tags stripped, no XSS possible

---

### Test Case 8.2: Long Display Names
**Objective:** Verify name length limit

**Steps:**
1. Create user with very long display name (200+ characters)
2. Check leaderboard display
3. Verify truncation

**Expected Result:**
- Name truncated to 50 characters max
- No UI overflow
- Ellipsis shown if needed

**Pass Criteria:** ✅ Names limited to 50 chars, no overflow

---

## 9. Sidebar Navigation Testing

### Test Case 9.1: Members Navigation
**Objective:** Verify Members menu item works

**Steps:**
1. Open community sidebar
2. Tap "Members" item
3. Observe navigation

**Expected Result:**
- Sidebar closes
- Navigates back to community info
- Could show members tab/section

**Pass Criteria:** ✅ Proper navigation occurs

---

### Test Case 9.2: Invite Functionality
**Objective:** Verify invite shows share dialog

**Steps:**
1. Open sidebar
2. Tap "Invite Friends"
3. Observe behavior

**Expected Result:**
- Alert appears with community name
- "Share Community" title
- Options: Cancel, Share
- Community ID logged in console (for now)

**Pass Criteria:** ✅ Share alert appears correctly

---

## 10. Integration Testing

### Test Case 10.1: Complete Check-In Flow
**Objective:** End-to-end test with all fixes

**Steps:**
1. Navigate to community
2. Open sidebar
3. Go to Check-In screen
4. Check in successfully
5. View leaderboard
6. Check your rank
7. Navigate through sidebar items

**Expected Result:**
- All screens load properly
- Check-in updates immediately
- Leaderboard reflects new points
- Rank updates correctly
- No errors in console
- Smooth animations
- Proper navigation

**Pass Criteria:** ✅ Complete flow works seamlessly

---

## Performance Benchmarks

### Baseline Metrics (After Fixes)
| Metric | Target | Acceptable | Poor |
|--------|--------|------------|------|
| Leaderboard Load (50 users) | < 2s | < 3s | > 3s |
| Check-In Response | < 1s | < 2s | > 2s |
| Firestore Reads (50 users) | ≤ 6 | ≤ 10 | > 10 |
| Memory Usage Growth | 0% | < 5% | > 5% |
| Animation FPS | 60 | > 45 | < 45 |

---

## Automated Test Script

```javascript
// test/leaderboard-fixes.test.js
describe('Leaderboard Fixes', () => {
  test('prevents race condition', async () => {
    const promises = Array(10).fill().map(() => 
      checkInToCommunity(db, communityId, userId)
    );
    const results = await Promise.all(promises);
    const successes = results.filter(r => r.success);
    expect(successes.length).toBe(1);
  });

  test('uses UTC dates', () => {
    const date = getTodayDate();
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Verify it matches UTC, not local
  });

  test('sanitizes display names', () => {
    const malicious = '<script>alert("XSS")</script>Evil';
    const safe = sanitizeDisplayName(malicious);
    expect(safe).not.toContain('<');
    expect(safe).not.toContain('>');
  });

  test('validates inputs', async () => {
    await expect(
      getUserCheckInData(null, 'id', 'user')
    ).rejects.toThrow('Firestore instance is required');
  });
});
```

---

## Bug Report Template

If you find issues during testing:

```
**Bug Title:** [Brief description]

**Severity:** Critical / High / Medium / Low

**Steps to Reproduce:**
1. 
2. 
3. 

**Expected Result:**


**Actual Result:**


**Environment:**
- Device: 
- OS Version: 
- App Version: 
- Network: WiFi / Mobile Data / Offline

**Screenshots/Logs:**


**Related Fix:** [Which of the 10 fixes this relates to]
```

---

## Sign-Off Checklist

Before marking fixes as complete:

- [ ] All 10 test categories passed
- [ ] No console errors during testing
- [ ] Performance within acceptable range
- [ ] Offline mode works correctly
- [ ] Memory leaks eliminated (verified with profiler)
- [ ] Security tests passed (XSS, race conditions)
- [ ] Cross-timezone testing completed
- [ ] Multiple devices tested
- [ ] Integration test passed
- [ ] Documentation reviewed

---

## Testing Schedule

### Phase 1: Unit Tests (1 day)
- Input validation
- Sanitization
- Date calculations
- Helper functions

### Phase 2: Integration Tests (1 day)
- Transaction flows
- Batch queries
- Error boundaries
- Offline support

### Phase 3: E2E Tests (1 day)
- Complete user flows
- Cross-device testing
- Performance testing
- Security testing

### Phase 4: UAT (2 days)
- Real user testing
- Edge case discovery
- Feedback collection
- Final adjustments

**Total Estimated Testing Time:** 5 days

---

## Success Criteria

✅ **All fixes implemented correctly**
✅ **Zero critical bugs found**
✅ **Performance targets met**
✅ **Security vulnerabilities eliminated**
✅ **User experience improved**
✅ **Production-ready**

---

Ready to test! 🧪
