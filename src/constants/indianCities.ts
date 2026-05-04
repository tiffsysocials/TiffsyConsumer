// Curated list of major Indian cities + their state.
// Used by the address-form city picker. Selecting a city auto-fills its mapped state.
// Add more entries as the delivery footprint grows.

export interface CityEntry {
  city: string;
  state: string;
}

export const INDIAN_CITIES: CityEntry[] = [
  // Madhya Pradesh (primary delivery state — most coverage)
  { city: 'Indore', state: 'Madhya Pradesh' },
  { city: 'Bhopal', state: 'Madhya Pradesh' },
  { city: 'Jabalpur', state: 'Madhya Pradesh' },
  { city: 'Gwalior', state: 'Madhya Pradesh' },
  { city: 'Ujjain', state: 'Madhya Pradesh' },
  { city: 'Sagar', state: 'Madhya Pradesh' },
  { city: 'Dewas', state: 'Madhya Pradesh' },
  { city: 'Satna', state: 'Madhya Pradesh' },
  { city: 'Ratlam', state: 'Madhya Pradesh' },
  { city: 'Rewa', state: 'Madhya Pradesh' },

  // Maharashtra
  { city: 'Mumbai', state: 'Maharashtra' },
  { city: 'Pune', state: 'Maharashtra' },
  { city: 'Nagpur', state: 'Maharashtra' },
  { city: 'Thane', state: 'Maharashtra' },
  { city: 'Nashik', state: 'Maharashtra' },
  { city: 'Aurangabad', state: 'Maharashtra' },
  { city: 'Solapur', state: 'Maharashtra' },
  { city: 'Navi Mumbai', state: 'Maharashtra' },

  // Delhi
  { city: 'New Delhi', state: 'Delhi' },
  { city: 'Delhi', state: 'Delhi' },

  // Uttar Pradesh
  { city: 'Lucknow', state: 'Uttar Pradesh' },
  { city: 'Kanpur', state: 'Uttar Pradesh' },
  { city: 'Agra', state: 'Uttar Pradesh' },
  { city: 'Varanasi', state: 'Uttar Pradesh' },
  { city: 'Prayagraj', state: 'Uttar Pradesh' },
  { city: 'Meerut', state: 'Uttar Pradesh' },
  { city: 'Ghaziabad', state: 'Uttar Pradesh' },
  { city: 'Noida', state: 'Uttar Pradesh' },
  { city: 'Greater Noida', state: 'Uttar Pradesh' },

  // Karnataka
  { city: 'Bengaluru', state: 'Karnataka' },
  { city: 'Mysuru', state: 'Karnataka' },
  { city: 'Mangaluru', state: 'Karnataka' },
  { city: 'Hubli', state: 'Karnataka' },
  { city: 'Belagavi', state: 'Karnataka' },

  // Tamil Nadu
  { city: 'Chennai', state: 'Tamil Nadu' },
  { city: 'Coimbatore', state: 'Tamil Nadu' },
  { city: 'Madurai', state: 'Tamil Nadu' },
  { city: 'Tiruchirappalli', state: 'Tamil Nadu' },
  { city: 'Salem', state: 'Tamil Nadu' },

  // Telangana
  { city: 'Hyderabad', state: 'Telangana' },
  { city: 'Warangal', state: 'Telangana' },
  { city: 'Secunderabad', state: 'Telangana' },

  // Andhra Pradesh
  { city: 'Visakhapatnam', state: 'Andhra Pradesh' },
  { city: 'Vijayawada', state: 'Andhra Pradesh' },
  { city: 'Guntur', state: 'Andhra Pradesh' },
  { city: 'Tirupati', state: 'Andhra Pradesh' },

  // West Bengal
  { city: 'Kolkata', state: 'West Bengal' },
  { city: 'Howrah', state: 'West Bengal' },
  { city: 'Durgapur', state: 'West Bengal' },
  { city: 'Siliguri', state: 'West Bengal' },

  // Gujarat
  { city: 'Ahmedabad', state: 'Gujarat' },
  { city: 'Surat', state: 'Gujarat' },
  { city: 'Vadodara', state: 'Gujarat' },
  { city: 'Rajkot', state: 'Gujarat' },
  { city: 'Gandhinagar', state: 'Gujarat' },

  // Rajasthan
  { city: 'Jaipur', state: 'Rajasthan' },
  { city: 'Jodhpur', state: 'Rajasthan' },
  { city: 'Udaipur', state: 'Rajasthan' },
  { city: 'Kota', state: 'Rajasthan' },
  { city: 'Ajmer', state: 'Rajasthan' },
  { city: 'Bikaner', state: 'Rajasthan' },

  // Punjab
  { city: 'Ludhiana', state: 'Punjab' },
  { city: 'Amritsar', state: 'Punjab' },
  { city: 'Jalandhar', state: 'Punjab' },
  { city: 'Patiala', state: 'Punjab' },

  // Haryana
  { city: 'Gurugram', state: 'Haryana' },
  { city: 'Faridabad', state: 'Haryana' },
  { city: 'Panipat', state: 'Haryana' },
  { city: 'Ambala', state: 'Haryana' },

  // Bihar
  { city: 'Patna', state: 'Bihar' },
  { city: 'Gaya', state: 'Bihar' },
  { city: 'Muzaffarpur', state: 'Bihar' },

  // Jharkhand
  { city: 'Ranchi', state: 'Jharkhand' },
  { city: 'Jamshedpur', state: 'Jharkhand' },
  { city: 'Dhanbad', state: 'Jharkhand' },

  // Chhattisgarh
  { city: 'Raipur', state: 'Chhattisgarh' },
  { city: 'Bhilai', state: 'Chhattisgarh' },
  { city: 'Bilaspur', state: 'Chhattisgarh' },

  // Odisha
  { city: 'Bhubaneswar', state: 'Odisha' },
  { city: 'Cuttack', state: 'Odisha' },
  { city: 'Rourkela', state: 'Odisha' },

  // Kerala
  { city: 'Kochi', state: 'Kerala' },
  { city: 'Thiruvananthapuram', state: 'Kerala' },
  { city: 'Kozhikode', state: 'Kerala' },

  // Assam
  { city: 'Guwahati', state: 'Assam' },
  { city: 'Dibrugarh', state: 'Assam' },

  // Uttarakhand
  { city: 'Dehradun', state: 'Uttarakhand' },
  { city: 'Haridwar', state: 'Uttarakhand' },
  { city: 'Roorkee', state: 'Uttarakhand' },

  // Himachal Pradesh
  { city: 'Shimla', state: 'Himachal Pradesh' },
  { city: 'Dharamshala', state: 'Himachal Pradesh' },

  // Goa
  { city: 'Panaji', state: 'Goa' },
  { city: 'Margao', state: 'Goa' },

  // Chandigarh
  { city: 'Chandigarh', state: 'Chandigarh' },

  // Jammu & Kashmir
  { city: 'Jammu', state: 'Jammu and Kashmir' },
  { city: 'Srinagar', state: 'Jammu and Kashmir' },
];

export function findStateForCity(city: string): string | undefined {
  const match = INDIAN_CITIES.find(c => c.city.toLowerCase() === city.toLowerCase());
  return match?.state;
}
