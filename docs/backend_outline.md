```


import express from "express";
import {
  getIsProfileComplete,
  onBoardingUser,
  createTestCustomer,
} from "./customer.auth.controller.js";
import { verifyFirebaseToken } from "../middleware/firebaseToken.middleware.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";

const router = express.Router();

/**
 * @route   GET /api/auth/customer/status
 * @desc    Get customer profile completion status
 * @access  Protected (Firebase Token Required)
 */
router.get("/status", verifyFirebaseToken, getIsProfileComplete);

/**
 * @route   PUT /api/auth/customer/onboarding
 * @desc    Complete customer onboarding by updating profile
 * @access  Protected (Firebase Token Required)
 */
router.put("/onboarding", verifyFirebaseToken, onBoardingUser);


---

/**
 * Middleware to verify Firebase ID token and extract user information
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const verifyFirebaseToken = async (req, res, next) => {
  try {
    console.log("\n=== Firebase Token Verification START ===");
    console.log("> Request URL:", req.originalUrl);
    console.log("> Request Method:", req.method);

    // Extract the token from Authorization header
    const authHeader = req.headers.authorization;
    console.log("> Authorization Header exists:", !!authHeader);
    console.log("> Authorization Header preview:", authHeader ? authHeader.substring(0, 20) + "..." : "N/A");

    // Check if Authorization header exists
    if (!authHeader) {
      console.log("> ERROR: Authorization header is missing");
      return sendError(res, 401, "Authorization header is missing", {
        error: "MISSING_AUTH_HEADER",
      });
    }

    // Check if Authorization header follows Bearer token format
    if (!authHeader.startsWith("Bearer ")) {
      console.log("> ERROR: Invalid authorization format");
      return sendError(
        res,
        401,
        "Invalid authorization format. Expected 'Bearer <token>'",
        {
          error: "INVALID_AUTH_FORMAT",
        }
      );
    }

    // Extract the token (remove "Bearer " prefix)
    const token = authHeader.substring(7);
    console.log("> Token extracted, length:", token.length);
    console.log("> Token preview:", token.substring(0, 30) + "...");

    // Check if token exists after "Bearer "
    if (!token || token.trim() === "") {
      console.log("> ERROR: Token is empty");
      return sendError(res, 401, "Token is missing in authorization header", {
        error: "MISSING_TOKEN",
      });
    }

    // Verify the Firebase ID token
    console.log("> Verifying token with Firebase Admin...");
    let decodedToken;
    try {
      decodedToken = await firebaseAdmin.auth().verifyIdToken(token);
      console.log("> Token verified successfully!");
      console.log("> Decoded token UID:", decodedToken.uid);
      console.log("> Decoded token phone_number:", decodedToken.phone_number);
      console.log("> Full decoded token:", JSON.stringify({
        uid: decodedToken.uid,
        phone_number: decodedToken.phone_number,
        email: decodedToken.email,
        email_verified: decodedToken.email_verified,
        name: decodedToken.name
      }, null, 2));
    } catch (verifyError) {
      console.log("> ERROR during token verification:");
      console.log("> Error code:", verifyError.code);
      console.log("> Error message:", verifyError.message);

      // Handle specific Firebase token verification errors
      if (verifyError.code === "auth/id-token-expired") {
        return sendError(
          res,
          401,
          "Token has expired. Please refresh your authentication",
          {
            error: "TOKEN_EXPIRED",
          }
        );
      }

      if (verifyError.code === "auth/id-token-revoked") {
        return sendError(
          res,
          401,
          "Token has been revoked. Please re-authenticate",
          {
            error: "TOKEN_REVOKED",
          }
        );
      }

      if (verifyError.code === "auth/argument-error") {
        return sendError(res, 401, "Invalid token format", {
          error: "INVALID_TOKEN_FORMAT",
        });
      }

      // Generic token verification failure
      return sendError(res, 401, "Failed to verify authentication token", {
        error: "TOKEN_VERIFICATION_FAILED",
        details:
          process.env.NODE_ENV === "development"
            ? verifyError.message
            : undefined,
      });
    }

    // Extract UID (always present in decoded token)
    const uid = decodedToken.uid;

    // Extract phone number (may not always be present)
    const phoneNumber = decodedToken.phone_number || null;

    console.log("> Extracted UID:", uid);
    console.log("> Extracted phoneNumber:", phoneNumber);

    // Validate that UID exists
    if (!uid) {
      console.log("> ERROR: UID is missing from decoded token");
      return sendError(res, 401, "Invalid token: User ID not found", {
        error: "MISSING_UID",
      });
    }

    // Attach user information to request object for use in route handlers
    req.firebaseUser = {
      uid,
      phoneNumber,
      email: decodedToken.email || null,
      emailVerified: decodedToken.email_verified || false,
      name: decodedToken.name || null,
      picture: decodedToken.picture || null,
      // Include full decoded token for advanced use cases
      decodedToken,
    };

    console.log("> req.firebaseUser created:", JSON.stringify({
      uid: req.firebaseUser.uid,
      phoneNumber: req.firebaseUser.phoneNumber,
      email: req.firebaseUser.email
    }, null, 2));
    console.log("=== Firebase Token Verification END (SUCCESS) ===\n");

    // Proceed to next middleware or route handler
    next();
  } catch (error) {
    // Catch any unexpected errors
    console.error("\n!!! ERROR in Firebase token verification middleware !!!");
    console.error("> Error name:", error.name);
    console.error("> Error message:", error.message);
    console.error("> Error stack:", error.stack);
    console.error("=== Firebase Token Verification END (ERROR) ===\n");

    return sendError(res, 500, "Internal server error during authentication", {
      error: "INTERNAL_AUTH_ERROR",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

---
/**
 * Get customer profile completion status
 * @route GET /api/auth/customer/status
 * @access Protected (Firebase Token Required)
 */
export const getIsProfileComplete = async (req, res) => {
  try {
    console.log("\n=== getIsProfileComplete START ===");

    // Extract Firebase user data from middleware
    console.log("> Step 1: Extracting Firebase user data from req.firebaseUser");
    console.log("> req.firebaseUser exists:", !!req.firebaseUser);
    console.log("> Full firebaseUser object:", JSON.stringify(req.firebaseUser, null, 2));

    const { uid, phoneNumber } = req.firebaseUser;
    console.log("> Extracted UID:", uid);
    console.log("> Extracted Phone:", phoneNumber);

    // Validate that we have either uid or phone number
    if (!uid && !phoneNumber) {
      console.log("> ERROR: No user identification found");
      return sendError(res, 400, "User identification not found in token", {
        error: "MISSING_USER_IDENTIFICATION",
      });
    }

    // Build query to find customer by firebaseUid or phone
    const query = {
      isDeleted: false,
    };

    if (uid) {
      query.firebaseUid = uid;
    } else if (phoneNumber) {
      query.phone = phoneNumber;
    }

    console.log("> Step 2: Built query:", JSON.stringify(query, null, 2));

    // Check if customer profile exists
    console.log("> Step 3: Searching for customer in database...");
    let customer = await Customer.findOne(query);
    console.log("> Customer found:", customer ? "YES" : "NO");
    if (customer) {
      console.log("> Existing customer ID:", customer._id);
      console.log("> Existing customer data:", JSON.stringify({
        _id: customer._id,
        name: customer.name,
        phone: customer.phone,
        firebaseUid: customer.firebaseUid,
        isProfileComplete: customer.isProfileComplete
      }, null, 2));
    }

    // If customer doesn't exist, create a new record
    if (!customer) {
      console.log("> Step 4: Customer not found, creating new customer...");
      const newCustomerData = {
        phone: phoneNumber || null,
        firebaseUid: uid,
        isProfileComplete: false,
      };
      console.log("> New customer data:", JSON.stringify(newCustomerData, null, 2));

      try {
        customer = await Customer.create(newCustomerData);
        console.log("> SUCCESS: New customer created with ID:", customer._id);

        return sendSuccess(res, 201, "Customer profile created successfully", {
          isProfileComplete: false,
          customerId: customer._id,
          isNewUser: true,
        });
      } catch (createError) {
        console.log("> ERROR during customer creation:");
        console.log("> Error code:", createError.code);
        console.log("> Error name:", createError.name);
        console.log("> Error message:", createError.message);
        console.log("> Full error:", JSON.stringify(createError, null, 2));

        // Handle duplicate key errors
        if (createError.code === 11000) {
          console.log("> Duplicate key error detected");
          return sendError(
            res,
            409,
            "Customer profile already exists with this phone number or Firebase UID",
            {
              error: "DUPLICATE_CUSTOMER",
            }
          );
        }

        console.log("> Rethrowing error to outer catch block");
        throw createError;
      }
    }

    // Return existing customer's profile completion status
    console.log("> Step 5: Returning existing customer's profile status");
    const responseData = {
      isProfileComplete: customer.isProfileComplete,
      customerId: customer._id,
      isNewUser: false,
      hasName: !!customer.name,
      hasDietaryPreferences: !!customer.dietaryPreferences?.foodType,
    };
    console.log("> Response data:", JSON.stringify(responseData, null, 2));
    console.log("=== getIsProfileComplete END (SUCCESS) ===\n");

    return sendSuccess(res, 200, "Profile status retrieved successfully", responseData);
  } catch (error) {
    console.error("\n!!! ERROR in getIsProfileComplete !!!");
    console.error("> Error name:", error.name);
    console.error("> Error message:", error.message);
    console.error("> Error stack:", error.stack);
    console.error("> Full error object:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    console.error("=== getIsProfileComplete END (ERROR) ===\n");

    return sendError(
      res,
      500,
      "Failed to retrieve profile status",
      process.env.NODE_ENV === "development"
        ? { error: error.message, stack: error.stack }
        : undefined
    );
  }
};

/**
 * Complete customer onboarding by updating profile
 * @route PUT /api/auth/customer/onboarding
 * @access Protected (Firebase Token Required)
 */
export const onBoardingUser = async (req, res) => {
  try {
    // Extract Firebase user data from middleware
    const { uid, phoneNumber } = req.firebaseUser;

    // Validate that we have user identification
    if (!uid && !phoneNumber) {
      return sendError(res, 400, "User identification not found in token", {
        error: "MISSING_USER_IDENTIFICATION",
      });
    }

    // Extract and validate request body
    const { name, email, dietaryPreferences } = req.body;

    // Validate required fields
    if (!name || !name.trim()) {
      return sendError(res, 400, "Name is required for onboarding", {
        error: "MISSING_NAME",
      });
    }

    // Validate name length
    if (name.trim().length < 2) {
      return sendError(res, 400, "Name must be at least 2 characters long", {
        error: "INVALID_NAME_LENGTH",
      });
    }

    if (name.trim().length > 100) {
      return sendError(res, 400, "Name cannot exceed 100 characters", {
        error: "INVALID_NAME_LENGTH",
      });
    }

    // Validate email format if provided
    if (email) {
      const emailRegex = /^\S+@\S+\.\S+$/;
      if (!emailRegex.test(email)) {
        return sendError(res, 400, "Please provide a valid email address", {
          error: "INVALID_EMAIL_FORMAT",
        });
      }
    }

    // Validate dietary preferences if provided
    if (dietaryPreferences) {
      const { foodType, spiceLevel, dabbaType } = dietaryPreferences;

      // Validate foodType enum
      if (
        foodType &&
        !["VEG", "NON-VEG", "VEGAN"].includes(foodType.toUpperCase())
      ) {
        return sendError(res, 400, "Invalid food type", {
          error: "INVALID_FOOD_TYPE",
          allowedValues: ["VEG", "NON-VEG", "VEGAN"],
        });
      }

      // Validate spiceLevel enum
      if (
        spiceLevel &&
        !["HIGH", "MEDIUM", "LOW"].includes(spiceLevel.toUpperCase())
      ) {
        return sendError(res, 400, "Invalid spice level", {
          error: "INVALID_SPICE_LEVEL",
          allowedValues: ["HIGH", "MEDIUM", "LOW"],
        });
      }

      // Validate dabbaType enum
      if (
        dabbaType &&
        !["DISPOSABLE", "STEEL DABBA"].includes(dabbaType.toUpperCase())
      ) {
        return sendError(res, 400, "Invalid dabba type", {
          error: "INVALID_DABBA_TYPE",
          allowedValues: ["DISPOSABLE", "STEEL DABBA"],
        });
      }
    }

    // Build query to find customer
    const query = {
      isDeleted: false,
    };

    if (uid) {
      query.firebaseUid = uid;
    } else if (phoneNumber) {
      query.phone = phoneNumber;
    }

    // Check if customer profile exists
    let customer = await Customer.findOne(query);

    if (!customer) {
      return sendError(
        res,
        404,
        "Customer profile not found. Please check profile status first",
        {
          error: "CUSTOMER_NOT_FOUND",
        }
      );
    }

    // Prepare update data
    const updateData = {
      name: name.trim(),
    };

    // Add email if provided
    if (email) {
      updateData.email = email.trim().toLowerCase();
    }

    // Add dietary preferences if provided
    if (dietaryPreferences) {
      updateData.dietaryPreferences = {
        ...customer.dietaryPreferences,
        ...dietaryPreferences,
      };

      // Normalize enum values to uppercase
      if (dietaryPreferences.foodType) {
        updateData.dietaryPreferences.foodType =
          dietaryPreferences.foodType.toUpperCase();
      }
      if (dietaryPreferences.spiceLevel) {
        updateData.dietaryPreferences.spiceLevel =
          dietaryPreferences.spiceLevel.toUpperCase();
      }
      if (dietaryPreferences.dabbaType) {
        updateData.dietaryPreferences.dabbaType =
          dietaryPreferences.dabbaType.toUpperCase();
      }
    }

    // Set isProfileComplete to true if we have name and dietary preferences
    const hasDietaryPrefs =
      dietaryPreferences?.foodType || customer.dietaryPreferences?.foodType;

    if (name && hasDietaryPrefs) {
      updateData.isProfileComplete = true;
    }

    // Update customer profile
    try {
      customer = await Customer.findOneAndUpdate(
        query,
        { $set: updateData },
        {
          new: true,
          runValidators: true,
        }
      );

      console.log(`> Customer profile updated for UID: ${uid}`);

      return sendSuccess(res, 200, "Profile updated successfully", {
        customerId: customer._id,
        isProfileComplete: customer.isProfileComplete,
        name: customer.name,
        email: customer.email,
        dietaryPreferences: customer.dietaryPreferences,
      });
    } catch (updateError) {
      // Handle duplicate email error
      if (updateError.code === 11000) {
        return sendError(
          res,
          409,
          "Email address is already registered with another account",
          {
            error: "DUPLICATE_EMAIL",
          }
        );
      }

      // Handle validation errors
      if (updateError.name === "ValidationError") {
        const validationErrors = Object.values(updateError.errors).map(
          (err) => err.message
        );
        return sendError(res, 400, "Validation failed", {
          error: "VALIDATION_ERROR",
          details: validationErrors,
        });
      }

      throw updateError;
    }
  } catch (error) {
    console.error("Error in onBoardingUser:", error);
    return sendError(
      res,
      500,
      "Failed to update customer profile",
      process.env.NODE_ENV === "development"
        ? { error: error.message }
        : undefined
    );
  }
};

---




```
