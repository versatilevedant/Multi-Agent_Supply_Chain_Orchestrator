// ================================================================
// RaktaSetu — Hospitals Dataset
// Real Indian hospitals that request blood
// ================================================================

const HOSPITALS = [
  {
    id: 'H001', name: 'AIIMS Trauma Centre', city: 'New Delhi', state: 'Delhi',
    lat: 28.5653, lng: 77.2083, type: 'Government', departments: ['Trauma', 'Surgery', 'Orthopaedics'],
    avgDailyDemand: 45, emergencyRate: 0.35
  },
  {
    id: 'H002', name: 'Safdarjung Hospital', city: 'New Delhi', state: 'Delhi',
    lat: 28.5686, lng: 77.2044, type: 'Government', departments: ['Surgery', 'Obstetrics', 'Medicine'],
    avgDailyDemand: 38, emergencyRate: 0.28
  },
  {
    id: 'H003', name: 'Tata Memorial Hospital', city: 'Mumbai', state: 'Maharashtra',
    lat: 19.0048, lng: 72.8435, type: 'Government', departments: ['Oncology', 'Surgery', 'Radiation'],
    avgDailyDemand: 55, emergencyRate: 0.20
  },
  {
    id: 'H004', name: 'KEM Hospital', city: 'Mumbai', state: 'Maharashtra',
    lat: 19.0003, lng: 72.8421, type: 'Government', departments: ['Surgery', 'Medicine', 'Obstetrics', 'Trauma'],
    avgDailyDemand: 42, emergencyRate: 0.30
  },
  {
    id: 'H005', name: 'Rajiv Gandhi GGH', city: 'Chennai', state: 'Tamil Nadu',
    lat: 13.0785, lng: 80.2754, type: 'Government', departments: ['Surgery', 'Medicine', 'Trauma'],
    avgDailyDemand: 40, emergencyRate: 0.25
  },
  {
    id: 'H006', name: 'Apollo Hospital Chennai', city: 'Chennai', state: 'Tamil Nadu',
    lat: 13.0101, lng: 80.2275, type: 'Private', departments: ['Cardiac', 'Oncology', 'Transplant'],
    avgDailyDemand: 35, emergencyRate: 0.15
  },
  {
    id: 'H007', name: 'SSKM Hospital', city: 'Kolkata', state: 'West Bengal',
    lat: 22.5347, lng: 88.3410, type: 'Government', departments: ['Surgery', 'Medicine', 'Trauma'],
    avgDailyDemand: 38, emergencyRate: 0.25
  },
  {
    id: 'H008', name: 'Narayana Health City', city: 'Bangalore', state: 'Karnataka',
    lat: 12.8910, lng: 77.5977, type: 'Private', departments: ['Cardiac', 'Paediatric', 'Transplant'],
    avgDailyDemand: 40, emergencyRate: 0.18
  },
  {
    id: 'H009', name: 'NIMS Hyderabad', city: 'Hyderabad', state: 'Telangana',
    lat: 17.3932, lng: 78.3940, type: 'Government', departments: ['Surgery', 'Transplant', 'Nephrology'],
    avgDailyDemand: 35, emergencyRate: 0.22
  },
  {
    id: 'H010', name: 'PGI Chandigarh', city: 'Chandigarh', state: 'Chandigarh',
    lat: 30.7642, lng: 76.7773, type: 'Government', departments: ['Surgery', 'Haematology', 'Transplant'],
    avgDailyDemand: 45, emergencyRate: 0.20
  },
  {
    id: 'H011', name: 'SMS Hospital Jaipur', city: 'Jaipur', state: 'Rajasthan',
    lat: 26.8994, lng: 75.8087, type: 'Government', departments: ['Trauma', 'Surgery', 'Burns'],
    avgDailyDemand: 35, emergencyRate: 0.30
  },
  {
    id: 'H012', name: 'KGMU Lucknow', city: 'Lucknow', state: 'Uttar Pradesh',
    lat: 26.8614, lng: 80.9330, type: 'Government', departments: ['Surgery', 'Medicine', 'Paediatrics'],
    avgDailyDemand: 40, emergencyRate: 0.25
  },
  {
    id: 'H013', name: 'Civil Hospital Ahmedabad', city: 'Ahmedabad', state: 'Gujarat',
    lat: 23.0365, lng: 72.5852, type: 'Government', departments: ['Surgery', 'Medicine', 'Obstetrics'],
    avgDailyDemand: 35, emergencyRate: 0.28
  },
  {
    id: 'H014', name: 'Sassoon Hospital Pune', city: 'Pune', state: 'Maharashtra',
    lat: 18.5300, lng: 73.8740, type: 'Government', departments: ['Surgery', 'Trauma', 'Medicine'],
    avgDailyDemand: 30, emergencyRate: 0.25
  },
  {
    id: 'H015', name: 'GMCH Guwahati', city: 'Guwahati', state: 'Assam',
    lat: 26.1432, lng: 91.7270, type: 'Government', departments: ['Surgery', 'Medicine', 'Obstetrics'],
    avgDailyDemand: 25, emergencyRate: 0.22
  }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { HOSPITALS };
}
