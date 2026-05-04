## **Streamlined Phone Auth & Onboarding Logic**

### **Phase 1: Authentication (Session Creation)**

- **Actors:** User, RN App, Firebase Auth.
- **Flow:**
  1.  **Input:** User inputs Phone + OTP.
  2.  **Verification:** Firebase SDK verifies OTP.
  3.  **Persistence:** On success, Firebase SDK creates a persistent session on the device (AsyncStorage/Keystore).
  4.  **State:** User is `Authenticated` (but potentially `Profile Incomplete`).

---

### **Phase 2: Synchronization & Profile Completion**

- **Actors:** RN App, Node.js Backend, Firebase Admin SDK.
- **Mechanism:** Authentication relies on the **Firebase ID Token** (JWT) passed in API headers, not user input.

#### **Step-by-Step Execution**

1.  **Session Check (RN App):**

    - On App Launch $\rightarrow$ Check `firebase.auth().currentUser`.
    - If `null` $\rightarrow$ Redirect to Login.
    - If `exists` $\rightarrow$ Call `currentUser.getIdToken(true)` to refresh/retrieve JWT.

2.  **Status Check (API Call):**

    - **Request:** `GET /user/status`
    - **Header:** `Authorization: Bearer <ID_TOKEN>`
    - **Payload:** None (Identity is in the token).

3.  **Token Verification (Node.js):**

    - **Action:** `admin.auth().verifyIdToken(token)`.
    - **Extract:** Get `uid` and `phone_number` from decoded claims.
    - **DB Lookup:** Query User DB by `uid`.

4.  **Logic Branching (Backend):**

    - **Scenario A (User Exists):** Return User Object $\rightarrow$ App proceeds to Home.
    - **Scenario B (New User):**
      - Create "Stub" User (`uid`, `phone`, `profileStatus: 'incomplete'`).
      - Return `4xx` or distinct status code `PROFILE_INCOMPLETE`.

5.  **Onboarding (RN App):**

    - Receive `PROFILE_INCOMPLETE`.
    - Navigate to **Profile Completion Screen**.
    - **Note:** No need to ask for Phone Number (it is already securely bound to the session).

6.  **Final Submission:**
    - **Request:** `POST /user/complete-profile`.
    - **Header:** `Authorization: Bearer <ID_TOKEN>`.
    - **Payload:** `{ name: "John Doe", email: "..." }`.
    - **Backend Action:** Updates DB record associated with the token's `uid`. Sets `profileStatus: 'complete'`.

### **System Context Summary**

- **Security:** The Backend never trusts client-side IDs. It only trusts the `uid` decoded from the verified ID Token.
- **UX:** The phone number is extracted from the token, eliminating redundant data entry.
- **Persistence:** App restarts do not require re-login; the Firebase SDK auto-restores the session to generate new tokens.

---
