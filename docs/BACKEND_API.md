# Customer Authentication API Documentation

## Base URL

```
/api/auth/customer
```

---

## 1. Get Customer Profile Status

### Endpoint

```
GET /api/auth/customer/status
```

### Description

Retrieves the customer profile completion status. If the customer doesn't exist in the database, a new customer record is automatically created.

### Access

Protected (Requires Firebase Authentication Token)

### Headers

```
Authorization: Bearer <firebase_id_token>
Content-Type: application/json
```

### Request Body

No request body required.

### Success Responses

#### 200 OK - Existing Customer

```json
{
  "success": true,
  "message": "Profile status retrieved successfully",
  "data": {
    "isProfileComplete": false,
    "customerId": "507f1f77bcf86cd799439011",
    "isNewUser": false,
    "hasName": true,
    "hasDietaryPreferences": true
  }
}
```

#### 201 Created - New Customer

```json
{
  "success": true,
  "message": "Customer profile created successfully",
  "data": {
    "isProfileComplete": false,
    "customerId": "507f1f77bcf86cd799439011",
    "isNewUser": true
  }
}
```

### Error Responses

#### 400 Bad Request - Missing User Identification

```json
{
  "success": false,
  "message": "User identification not found in token",
  "data": {
    "error": "MISSING_USER_IDENTIFICATION"
  }
}
```

#### 409 Conflict - Duplicate Customer

```json
{
  "success": false,
  "message": "Customer profile already exists with this phone number or Firebase UID",
  "data": {
    "error": "DUPLICATE_CUSTOMER"
  }
}
```

#### 500 Internal Server Error

```json
{
  "success": false,
  "message": "Failed to retrieve profile status",
  "data": {
    "error": "Error message details",
    "stack": "Stack trace (development only)"
  }
}
```

### Sample Request

```bash
curl -X GET \
  'http://localhost:3000/api/auth/customer/status' \
  -H 'Authorization: Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IjEx...' \
  -H 'Content-Type: application/json'
```

---

## 2. Complete Customer Onboarding

### Endpoint

```
PUT /api/auth/customer/onboarding
```

### Description

Completes the customer onboarding process by updating their profile with name, email, and dietary preferences. Sets `isProfileComplete` to `true` when name and dietary preferences are provided.

### Access

Protected (Requires Firebase Authentication Token)

### Headers

```
Authorization: Bearer <firebase_id_token>
Content-Type: application/json
```

### Request Body

```json
{
  "name": "John Doe",
  "email": "john.doe@example.com",
  "dietaryPreferences": {
    "foodType": "VEG",
    "eggiterian": false,
    "jainFriendly": true,
    "dabbaType": "STEEL DABBA",
    "spiceLevel": "MEDIUM"
  }
}
```

#### Required Fields

- `name` (string, 2-100 characters)

#### Optional Fields

- `email` (string, valid email format)
- `dietaryPreferences` (object):
  - `foodType` (enum: `"VEG"`, `"NON-VEG"`, `"VEGAN"`) - Default: `"VEG"`
  - `eggiterian` (boolean) - Default: `false`
  - `jainFriendly` (boolean) - Default: `false`
  - `dabbaType` (enum: `"DISPOSABLE"`, `"STEEL DABBA"`) - Default: `"DISPOSABLE"`
  - `spiceLevel` (enum: `"HIGH"`, `"MEDIUM"`, `"LOW"`) - Default: `"MEDIUM"`

### Success Response

#### 200 OK

```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "customerId": "507f1f77bcf86cd799439011",
    "isProfileComplete": true,
    "name": "John Doe",
    "email": "john.doe@example.com",
    "dietaryPreferences": {
      "foodType": "VEG",
      "eggiterian": false,
      "jainFriendly": true,
      "dabbaType": "STEEL DABBA",
      "spiceLevel": "MEDIUM"
    }
  }
}
```

### Error Responses

#### 400 Bad Request - Missing User Identification

```json
{
  "success": false,
  "message": "User identification not found in token",
  "data": {
    "error": "MISSING_USER_IDENTIFICATION"
  }
}
```

#### 400 Bad Request - Missing Name

```json
{
  "success": false,
  "message": "Name is required for onboarding",
  "data": {
    "error": "MISSING_NAME"
  }
}
```

#### 400 Bad Request - Invalid Name Length

```json
{
  "success": false,
  "message": "Name must be at least 2 characters long",
  "data": {
    "error": "INVALID_NAME_LENGTH"
  }
}
```

#### 400 Bad Request - Invalid Email

```json
{
  "success": false,
  "message": "Please provide a valid email address",
  "data": {
    "error": "INVALID_EMAIL_FORMAT"
  }
}
```

#### 400 Bad Request - Invalid Food Type

```json
{
  "success": false,
  "message": "Invalid food type",
  "data": {
    "error": "INVALID_FOOD_TYPE",
    "allowedValues": ["VEG", "NON-VEG", "VEGAN"]
  }
}
```

#### 400 Bad Request - Invalid Spice Level

```json
{
  "success": false,
  "message": "Invalid spice level",
  "data": {
    "error": "INVALID_SPICE_LEVEL",
    "allowedValues": ["HIGH", "MEDIUM", "LOW"]
  }
}
```

#### 400 Bad Request - Invalid Dabba Type

```json
{
  "success": false,
  "message": "Invalid dabba type",
  "data": {
    "error": "INVALID_DABBA_TYPE",
    "allowedValues": ["DISPOSABLE", "STEEL DABBA"]
  }
}
```

#### 400 Bad Request - Validation Error

```json
{
  "success": false,
  "message": "Validation failed",
  "data": {
    "error": "VALIDATION_ERROR",
    "details": [
      "Name must be at least 2 characters long",
      "Please provide a valid email address"
    ]
  }
}
```

#### 404 Not Found - Customer Not Found

```json
{
  "success": false,
  "message": "Customer profile not found. Please check profile status first",
  "data": {
    "error": "CUSTOMER_NOT_FOUND"
  }
}
```

#### 409 Conflict - Duplicate Email

```json
{
  "success": false,
  "message": "Email address is already registered with another account",
  "data": {
    "error": "DUPLICATE_EMAIL"
  }
}
```

#### 500 Internal Server Error

```json
{
  "success": false,
  "message": "Failed to update customer profile",
  "data": {
    "error": "Error message details (development only)"
  }
}
```

### Sample Requests

#### Minimal Request (Name Only)

```bash
curl -X PUT \
  'http://localhost:3000/api/auth/customer/onboarding' \
  -H 'Authorization: Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IjEx...' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "John Doe"
  }'
```

#### Complete Request (All Fields)

```bash
curl -X PUT \
  'http://localhost:3000/api/auth/customer/onboarding' \
  -H 'Authorization: Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IjEx...' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "John Doe",
    "email": "john.doe@example.com",
    "dietaryPreferences": {
      "foodType": "VEG",
      "eggiterian": false,
      "jainFriendly": true,
      "dabbaType": "STEEL DABBA",
      "spiceLevel": "MEDIUM"
    }
  }'
```

---

## Authentication

Both endpoints require Firebase Authentication. Include the Firebase ID token in the `Authorization` header as a Bearer token.

### Getting Firebase Token

```javascript
// Example using Firebase SDK
import { getAuth } from 'firebase/auth';

const auth = getAuth();
const user = auth.currentUser;
if (user) {
  const token = await user.getIdToken();
  // Use this token in the Authorization header
}
```

---

## Common Error Handling

All endpoints follow a consistent error response format:

```json
{
  "success": false,
  "message": "Human-readable error message",
  "data": {
    "error": "ERROR_CODE",
    "details": "Additional error details (optional)"
  }
}
```

---

## Notes

1. **Profile Completion**: A profile is considered complete when both `name` and `dietaryPreferences.foodType` are provided.
2. **Automatic Customer Creation**: The `/status` endpoint automatically creates a customer record if one doesn't exist.
3. **Case Insensitivity**: Enum values (`foodType`, `spiceLevel`, `dabbaType`) are automatically converted to uppercase.
4. **Email Uniqueness**: Email addresses must be unique across all customer accounts.
5. **Soft Deletes**: The system uses soft deletes (`isDeleted` flag) for customer records.
