const TEST_BASE_URL = 'https://tiffsy-backend-8ecm.onrender.com';
const PROD_BASE_URL = 'https://d31od4t2t5epcb.cloudfront.net';

// Set to true to force the Render test URL (including in dev). Leave false to use
// the AWS (CloudFront) product backend everywhere.
const FORCE_TEST_URL = false;

export const BASE_URL = FORCE_TEST_URL ? TEST_BASE_URL : PROD_BASE_URL;
