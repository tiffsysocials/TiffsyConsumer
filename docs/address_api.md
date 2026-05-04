## Consumer Menu & Serviceability API

---

### 1. Check Serviceability

**Purpose:** Validate if we deliver to a pincode before user adds address (Blinkit/Zepto style entry point)

**Endpoint:** `POST /api/customer/check-serviceability`

**Headers:**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Request Body:**

```json
{
  "pincode": "560001"
}
```

**Response (Serviceable):**

```json
{
  "success": true,
  "message": "Location check",
  "data": {
    "isServiceable": true,
    "message": "We deliver to this location!"
  }
}
```

**Response (Not Serviceable):**

```json
{
  "success": true,
  "message": "Location check",
  "data": {
    "isServiceable": false,
    "message": "We don't deliver to this location yet"
  }
}
```

---

### 2. Get Home Feed with Menu

**Purpose:** Get menu from primary kitchen serving user's address zone, with option to switch kitchens

**Endpoint:** `GET /api/customer/home`

**Query Params:**

- `addressId` (optional) - specific address ID, defaults to user's default address
- `kitchenId` (optional) - switch to specific kitchen instead of auto-selected primary

**Headers:**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request Example:**

```
GET /api/customer/home?addressId=6789abc123def456
```

**Response (Success):**

```json
{
  "success": true,
  "message": "Home feed",
  "data": {
    "address": {
      "id": "6789abc123def456",
      "label": "Home",
      "addressLine1": "42, MG Road",
      "locality": "Indiranagar",
      "city": "Bangalore"
    },
    "kitchen": {
      "id": "kitchen123abc",
      "displayName": "Tiffsy Kitchen",
      "fulfilledBy": "Fulfilled by Tiffsy",
      "type": "TIFFSY",
      "isPremium": false,
      "isGourmet": false,
      "rating": 4.5,
      "totalRatings": 128
    },
    "_kitchenId": "kitchen123abc",
    "alternativeKitchens": [
      {
        "id": "kitchen456def",
        "displayName": "Partner Kitchen",
        "fulfilledBy": "Fulfilled by Partner Kitchen",
        "type": "PARTNER",
        "isPremium": true,
        "isGourmet": false,
        "rating": 4.2,
        "totalRatings": 89
      }
    ],
    "hasAlternatives": true,
    "mealWindow": {
      "current": "LUNCH",
      "isLunchActive": true,
      "isDinnerActive": false
    },
    "menu": {
      "mealMenu": {
        "lunch": {
          "id": "item123",
          "name": "South Indian Thali",
          "description": "Rice, sambar, rasam, 2 sabzis, curd, pickle, papad",
          "category": "THALI",
          "menuType": "MEAL_MENU",
          "mealWindow": "LUNCH",
          "price": 149,
          "discountedPrice": 129,
          "portionSize": "REGULAR",
          "dietaryType": "VEG",
          "isJainFriendly": false,
          "spiceLevel": "MEDIUM",
          "images": ["https://cdn.tiffsy.com/thali1.jpg"],
          "thumbnailImage": "https://cdn.tiffsy.com/thali1_thumb.jpg",
          "includes": ["Rice", "Sambar", "Rasam", "2 Sabzis", "Curd"],
          "isFeatured": true,
          "cutoffTime": "11:00",
          "isPastCutoff": false,
          "canUseVoucher": true,
          "cutoffMessage": "Order before 11:00 AM",
          "addons": [
            {
              "id": "addon1",
              "name": "Extra Roti (2 pcs)",
              "price": 20,
              "category": "BREAD"
            },
            {
              "id": "addon2",
              "name": "Sweet - Gulab Jamun",
              "price": 30,
              "category": "DESSERT"
            }
          ]
        },
        "dinner": {
          "id": "item456",
          "name": "North Indian Thali",
          "description": "Roti, dal, paneer sabzi, rice, salad, pickle",
          "price": 159,
          "discountedPrice": 139,
          "cutoffTime": "21:00",
          "isPastCutoff": false,
          "canUseVoucher": true,
          "cutoffMessage": "Order before 9:00 PM"
        }
      },
      "onDemandMenu": [
        {
          "id": "snack1",
          "name": "Samosa (2 pcs)",
          "price": 40,
          "category": "SNACKS",
          "menuType": "ON_DEMAND_MENU"
        }
      ]
    },
    "vouchers": {
      "lunch": 3,
      "dinner": 2,
      "total": 5
    }
  }
}
```

**Response (No Address Setup):**

```json
{
  "success": true,
  "message": "Add address to see available menu",
  "data": {
    "requiresAddressSetup": true,
    "addresses": [],
    "menu": null
  }
}
```

**Response (Address Not Serviceable):**

```json
{
  "success": true,
  "message": "Address not serviceable",
  "data": {
    "isServiceable": false,
    "address": {
      "id": "6789abc123def456",
      "label": "Office",
      "locality": "Remote Village",
      "city": "Unknown"
    },
    "message": "We don't deliver to this location yet. Try a different address."
  }
}
```

---

### 3. Switch Kitchen

**Purpose:** View menu from alternative kitchen (uses same home endpoint with kitchenId param)

**Endpoint:** `GET /api/customer/home?kitchenId=kitchen456def`

**Headers:**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request Example:**

```
GET /api/customer/home?addressId=6789abc123def456&kitchenId=kitchen456def
```

**Response:** Same structure as home feed, but with selected kitchen's menu

---

### 4. Get Detailed Meal Menu

**Purpose:** Get full details for a specific meal window (LUNCH/DINNER) with complete addon info

**Endpoint:** `GET /api/customer/menu/:mealWindow`

**Params:**

- `mealWindow` - LUNCH or DINNER

**Query Params:**

- `addressId` (optional) - defaults to user's default address
- `kitchenId` (optional) - specific kitchen

**Headers:**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request Example:**

```
GET /api/customer/menu/LUNCH?addressId=6789abc123def456
```

**Response:**

```json
{
  "success": true,
  "message": "Meal menu",
  "data": {
    "available": true,
    "mealWindow": "LUNCH",
    "kitchen": {
      "id": "kitchen123abc",
      "displayName": "Tiffsy Kitchen",
      "fulfilledBy": "Fulfilled by Tiffsy",
      "type": "TIFFSY",
      "isPremium": false,
      "isGourmet": false,
      "rating": 4.5,
      "totalRatings": 128
    },
    "_kitchenId": "kitchen123abc",
    "item": {
      "id": "item123",
      "name": "South Indian Thali",
      "description": "Rice, sambar, rasam, 2 sabzis, curd, pickle, papad",
      "price": 149,
      "discountedPrice": 129,
      "portionSize": "REGULAR",
      "dietaryType": "VEG",
      "isJainFriendly": false,
      "spiceLevel": "MEDIUM",
      "images": ["https://cdn.tiffsy.com/thali1.jpg"],
      "thumbnailImage": "https://cdn.tiffsy.com/thali1_thumb.jpg",
      "includes": ["Rice", "Sambar", "Rasam", "2 Sabzis", "Curd"],
      "addons": [
        {
          "id": "addon1",
          "name": "Extra Roti (2 pcs)",
          "description": "Soft wheat rotis",
          "price": 20,
          "category": "BREAD",
          "minQuantity": 1,
          "maxQuantity": 5
        },
        {
          "id": "addon2",
          "name": "Sweet - Gulab Jamun",
          "description": "2 pieces of gulab jamun",
          "price": 30,
          "category": "DESSERT",
          "minQuantity": 1,
          "maxQuantity": 3
        }
      ]
    },
    "cutoff": {
      "time": "11:00",
      "isPastCutoff": false,
      "message": "Order before 11:00 AM"
    },
    "vouchers": {
      "available": 3,
      "canUse": true,
      "message": "You have 3 voucher(s) available"
    }
  }
}
```

---

### Flow Summary

1. User opens app first time
2. App calls `POST /api/customer/check-serviceability` with pincode
3. If serviceable, user adds full address (separate address API)
4. App calls `GET /api/customer/home` to get menu
5. If multiple kitchens available, user can switch via `GET /api/customer/home?kitchenId=xxx`
6. For detailed meal view, call `GET /api/customer/menu/LUNCH` or `GET /api/customer/menu/DINNER`

---

prompt used:

```text
  - user sends a req to get the menu with the user selected address and pin code along with user current location in latitude and longitude (lat and long are optional) in body. and get the menu from all the kitchen which serves his pincode. 
  - selected pin code and address validation 
    - user is needed to select an address before he could surf the app
    - we validate if the user's selected address is in our servicesable zone or not (the pin code has any kitchen or any kitchen has listed that pincode in there serviceable pincode list) (similar to how blinkit and zepto does it)
```