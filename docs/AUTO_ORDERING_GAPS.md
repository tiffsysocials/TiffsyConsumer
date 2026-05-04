# Auto Ordering & Subscription Management Gap Analysis

## Overview
The "Tiffsy" application currently lacks the **Auto Ordering** functionality key to a subscription-based meal service. While users can purchase subscriptions (vouchers), they must manually place orders for every meal. 

This document outlines the missing features and the requirements for the Backend team (Claude) to implement the necessary infrastructure.

## Missing Features (Frontend & Backend)

1.  **Auto Ordering Integration:**
    *   **Current State:** Users have vouchers but must manually add meals to cart and checkout for every meal window.
    *   **Requirement:** An automated system that places an order on behalf of the user if they have active vouchers and have enabled "Auto Ordering".
    *   **Configuration:** User needs to specify *which* meal (Lunch vs Dinner) should be auto-ordered if they have a preference, or if the system should default to one based on the plan.

2.  **Pause & Resume Auto Orders:**
    *   **Current State:** Users can only "Cancel" a subscription. There is no temporary pause.
    *   **Requirement:** Users should be able to pause auto-ordering (e.g., while on vacation) without cancelling their plan, and resume it later.

3.  **Skip Next Meal:**
    *   **Current State:** No option to skip a specific upcoming meal.
    *   **Requirement:** A granular control to skip just the *next* immediate auto-order (e.g., "Skip Tomorrow's Lunch") effectively "saving" that voucher for later, without pausing the entire subscription.

## Backend Requirements (For Claude)

Please implement the following APIs and logic:

### 1. Database Schema Updates
*   **Customer/Subscription Model:**
    *   Add `autoOrderingEnabled` (Boolean).
    *   Add `defaultMealType` (Enum: `LUNCH`, `DINNER`, `BOTH` - if plan supports).
    *   Add `isPaused` (Boolean).
    *   Add `pausedUntil` (Date, optional).
    *   Add `skipNextMeal` (Boolean) or `skippedDates` (Array of Dates).

### 2. New API Endpoints

#### Subscription Settings
*   `GET /api/subscription/settings`
    *   Returns current auto-order status, pause status, and default meal preference.
*   `PUT /api/subscription/settings`
    *   Update `autoOrderingEnabled`, `defaultMealType`.

#### Actions
*   `POST /api/subscription/pause`
    *   Body: `{ startDate: Date, endDate?: Date }` (Optional end date for auto-resume).
*   `POST /api/subscription/resume`
    *   Clear pause flags.
*   `POST /api/subscription/skip-next-meal`
    *   Body: `{ mealWindow: 'LUNCH' | 'DINNER', date: Date }`
    *   Logic: Add this specific slot to a `skippedSlots` list so the cron job ignores it.

### 3. Background Job (Cron)
*   Implement a scheduled job (e.g., running daily at 1:00 AM) that:
    1.  Iterates through active subscriptions with `autoOrderingEnabled = true`.
    2.  Checks if `isPaused` is false.
    3.  Checks if the specific date/meal is NOT in `skippedSlots`.
    4.  Checks if user has sufficient `vouchers`.
    5.  **Creates an Order** automatically:
        *   Selects a default kitchen (logic needed: last ordered kitchen? or explicit default?).
        *   Selects the default meal item (e.g., Standard Thali).
        *   Deducts voucher.
        *   Sends push notification: "Your Lunch for today has been auto-ordered!".

## Frontend Implications (For later)
Once the backend is ready, the Frontend will need:
1.  **Subscription Settings Screen:** To toggle Auto-Order, set Lunch/Dinner preference.
2.  **Home Screen Widget:** To show "Next Auto-Order: Today Lunch" with a "Skip" button.
3.  **Profile/Subscription Management:** Buttons for "Pause Subscription".
