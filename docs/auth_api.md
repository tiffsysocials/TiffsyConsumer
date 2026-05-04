Implementation complete. Here is the updated API documentation:

Consumer Onboarding Flow - API Documentation
Base URL: /api

1. POST /api/auth/sync
   Check if user exists after Firebase OTP verification. Does NOT create users.

Headers:

Authorization: Bearer <firebase-id-token>
Request Body:

{}
Response (200 - User Exists, Profile Complete):

{
"status": 200,
"message": "User authenticated",
"data": {
"user": {
"\_id": "507f1f77bcf86cd799439011",
"phone": "9876543210",
"role": "CUSTOMER",
"name": "Rahul Sharma",
"email": "rahul@example.com",
"dietaryPreferences": ["VEG"],
"status": "ACTIVE",
"createdAt": "2024-01-15T10:30:00.000Z",
"updatedAt": "2024-01-15T10:30:00.000Z"
},
"isNewUser": false,
"isProfileComplete": true
}
}
Response (200 - User Exists, Profile Incomplete):

{
"status": 200,
"message": "User authenticated",
"data": {
"user": {
"\_id": "507f1f77bcf86cd799439011",
"phone": "9876543210",
"role": "CUSTOMER",
"name": null,
"status": "ACTIVE",
"createdAt": "2024-01-15T10:30:00.000Z",
"updatedAt": "2024-01-15T10:30:00.000Z"
},
"isNewUser": false,
"isProfileComplete": false
}
}
Response (200 - New User, Not Registered):

{
"status": 200,
"message": "User not found",
"data": {
"user": null,
"isNewUser": true,
"isProfileComplete": false
}
} 2. POST /api/auth/register
Register a new user. Call this when sync returns isNewUser: true.

Headers:

Authorization: Bearer <firebase-id-token>
Request Body:

{
"name": "Rahul Sharma",
"email": "rahul@example.com",
"dietaryPreferences": ["VEG"]
}
Response (201 - Success):

{
"status": 201,
"message": "User registered successfully",
"data": {
"user": {
"\_id": "507f1f77bcf86cd799439011",
"phone": "9876543210",
"role": "CUSTOMER",
"name": "Rahul Sharma",
"email": "rahul@example.com",
"dietaryPreferences": ["VEG"],
"status": "ACTIVE",
"createdAt": "2024-01-15T10:30:00.000Z",
"updatedAt": "2024-01-15T10:30:00.000Z"
},
"isProfileComplete": true
}
}
Response (409 - User Already Exists):

{
"status": 409,
"message": "User already exists",
"data": {
"user": {
"\_id": "507f1f77bcf86cd799439011",
"phone": "9876543210",
"role": "CUSTOMER",
"name": "Rahul Sharma"
},
"isProfileComplete": true
}
} 3. PUT /api/auth/profile
Update profile for existing users. Call when sync returns isProfileComplete: false.

Headers:

Authorization: Bearer <firebase-id-token>
Request Body:

{
"name": "Rahul Sharma",
"email": "rahul@example.com",
"dietaryPreferences": ["VEG", "JAIN"],
"profileImage": "https://res.cloudinary.com/example/image/upload/profile123.jpg"
}
Response (200):

{
"status": 200,
"message": "Profile updated",
"data": {
"user": {
"\_id": "507f1f77bcf86cd799439011",
"phone": "9876543210",
"role": "CUSTOMER",
"name": "Rahul Sharma",
"email": "rahul@example.com",
"dietaryPreferences": ["VEG", "JAIN"],
"profileImage": "https://res.cloudinary.com/example/image/upload/profile123.jpg",
"status": "ACTIVE",
"createdAt": "2024-01-15T10:30:00.000Z",
"updatedAt": "2024-01-15T10:35:00.000Z"
},
"isProfileComplete": true
}
} 4. POST /api/auth/fcm-token
Register FCM token for push notifications.

Headers:

Authorization: Bearer <firebase-id-token>
Request Body:

{
"fcmToken": "cMctpybZRQ2wL9v8Z7Xk3a:APA91bHJzV...",
"deviceId": "device-uuid-12345"
}
Response (200):

{
"status": 200,
"message": "FCM token registered",
"data": null
} 5. GET /api/zones/lookup/:pincode
Check if a pincode is serviceable. No auth required.

URL Example:

GET /api/zones/lookup/411001
Response (200 - Serviceable):

{
"status": 200,
"message": "Pincode lookup complete",
"data": {
"found": true,
"zone": {
"\_id": "507f1f77bcf86cd799439022",
"pincode": "411001",
"name": "Koregaon Park",
"city": "Pune"
},
"isServiceable": true,
"message": "This pincode is serviceable"
}
}
Response (200 - Not Serviceable):

{
"status": 200,
"message": "Pincode lookup complete",
"data": {
"found": false,
"zone": null,
"isServiceable": false,
"message": "This pincode is not in our service area"
}
} 6. GET /api/menu/kitchen/:kitchenId
Get complete menu for a kitchen. No auth required.

URL Example:

GET /api/menu/kitchen/507f1f77bcf86cd799439044
Response (200):

{
"status": 200,
"message": "Kitchen menu",
"data": {
"kitchen": {
"\_id": "507f1f77bcf86cd799439044",
"name": "Annapurna Kitchen",
"type": "CENTRAL",
"logo": "https://res.cloudinary.com/example/kitchen-logo.jpg",
"cuisineTypes": ["North Indian", "South Indian"],
"averageRating": 4.5
},
"mealMenu": {
"lunch": {
"\_id": "507f1f77bcf86cd799439066",
"name": "Lunch Thali",
"description": "Complete balanced meal",
"menuType": "MEAL_MENU",
"mealWindow": "LUNCH",
"price": 120,
"discountedPrice": 99,
"dietaryType": "VEG",
"isAvailable": true
},
"dinner": {
"\_id": "507f1f77bcf86cd799439088",
"name": "Dinner Thali",
"description": "Light dinner meal",
"menuType": "MEAL_MENU",
"mealWindow": "DINNER",
"price": 110,
"discountedPrice": 89,
"dietaryType": "VEG",
"isAvailable": true
}
},
"onDemandMenu": [],
"isVoucherEligible": true,
"isCouponEligible": true
}
}
Client Flow Summary

1. User enters phone number
2. Firebase sends OTP, user verifies
3. Firebase returns ID token to client
4. Client calls POST /api/auth/sync with Firebase token
   |
   +-- isNewUser: true --> Redirect to registration screen
   | User fills form
   | Call POST /api/auth/register
   |
   +-- isNewUser: false, isProfileComplete: false --> Redirect to complete profile
   | User fills form
   | Call PUT /api/auth/profile
   |
   +-- isNewUser: false, isProfileComplete: true --> Store user in context
   Continue to permissions

5. Request notification permission --> Call POST /api/auth/fcm-token
6. Request location permission or manual input
7. Call GET /api/zones/lookup/:pincode
   |
   +-- isServiceable: false --> Show "not serviceable" message
   |
   +-- isServiceable: true --> Navigate to menu screen
   Call GET /api/menu/kitchen/:kitchenId
