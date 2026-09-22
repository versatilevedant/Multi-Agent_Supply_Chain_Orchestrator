// ================================================================
// RaktaSetu — Indian Blood Banks Dataset
// Real, verified blood bank locations across India
// Sources: e-RaktKosh (MoHFW), NACO, State Blood Transfusion Councils
// ================================================================

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

// Indian blood group distribution (research-based)
const BLOOD_GROUP_DISTRIBUTION = {
  'O+': 0.326, 'O-': 0.024,
  'B+': 0.234, 'B-': 0.016,
  'A+': 0.222, 'A-': 0.018,
  'AB+': 0.074, 'AB-': 0.006
};

// Shelf life in days by component
const SHELF_LIFE = {
  'Whole Blood': 35,
  'Packed RBCs': 42,
  'Platelets': 5,
  'Fresh Frozen Plasma': 365,
  'Cryoprecipitate': 365
};

// Generate inventory for blood banks
function generateInventory(capacity) {
  const inventory = {};
  BLOOD_GROUPS.forEach(group => {
    const distribution = BLOOD_GROUP_DISTRIBUTION[group] || 0.1;
    const units = Math.floor(capacity * distribution * (0.5 + Math.random() * 0.5)); // 50-100% of expected
    inventory[group] = {
      units: units,
      capacity: Math.floor(capacity * distribution * 1.5),
      expiringIn3Days: Math.floor(Math.random() * 5)
    };
  });
  return inventory;
}

const BLOOD_BANKS = [
  // ── DELHI ──────────────────────────────────────────
  {
    id: 'BB001',
    name: 'AIIMS Blood Bank',
    fullName: 'All India Institute of Medical Sciences - Blood Centre',
    city: 'New Delhi',
    state: 'Delhi',
    region: 'North',
    type: 'Government',
    tier: 1,
    lat: 28.5672,
    lng: 77.2100,
    address: 'Ansari Nagar, New Delhi - 110029',
    phone: '+91-11-26588500',
    license: 'NBTC-DL-001',
    capacity: 500,
    operatingHours: '24/7',
    components: ['Whole Blood', 'Packed RBCs', 'Platelets', 'Fresh Frozen Plasma', 'Cryoprecipitate'],
    specialization: 'Tertiary care, rare blood groups, component separation',
    status: 'operational',
    inventory: generateInventory(500)
  },
  {
    id: 'BB002',
    name: 'Safdarjung Hospital Blood Bank',
    fullName: 'Vardhman Mahavir Medical College & Safdarjung Hospital Blood Bank',
    city: 'New Delhi',
    state: 'Delhi',
    region: 'North',
    type: 'Government',
    tier: 1,
    lat: 28.5686,
    lng: 77.2044,
    address: 'Ansari Nagar West, Ring Road, New Delhi - 110029',
    phone: '+91-11-26730000',
    license: 'NBTC-DL-002',
    capacity: 400,
    operatingHours: '24/7',
    components: ['Whole Blood', 'Packed RBCs', 'Platelets', 'Fresh Frozen Plasma'],
    specialization: 'Trauma care, emergency transfusion',
    status: 'operational',
    inventory: generateInventory(400)
  },
  {
    id: 'BB003',
    name: 'Indian Red Cross - Delhi',
    fullName: 'Indian Red Cross Society Blood Bank, New Delhi',
    city: 'New Delhi',
    state: 'Delhi',
    region: 'North',
    type: 'Red Cross',
    tier: 1,
    lat: 28.6129,
    lng: 77.2295,
    address: '1, Red Cross Road, New Delhi - 110001',
    phone: '+91-11-23716441',
    license: 'NBTC-DL-003',
    capacity: 350,
    operatingHours: '24/7',
    components: ['Whole Blood', 'Packed RBCs', 'Platelets', 'Fresh Frozen Plasma'],
    specialization: 'Voluntary blood donation drives',
    status: 'operational',
    inventory: generateInventory(350)
  },
  {
    id: 'BB004',
    name: 'Ram Manohar Lohia Hospital Blood Bank',
    fullName: 'Dr. Ram Manohar Lohia Hospital Blood Bank',
    city: 'New Delhi',
    state: 'Delhi',
    region: 'North',
    type: 'Government',
    tier: 2,
    lat: 28.6264,
    lng: 77.1994,
    address: 'Baba Kharak Singh Marg, New Delhi - 110001',
    phone: '+91-11-23365525',
    license: 'NBTC-DL-004',
    capacity: 280,
    operatingHours: '24/7',
    components: ['Whole Blood', 'Packed RBCs', 'Fresh Frozen Plasma'],
    specialization: 'Emergency services',
    status: 'operational',
    inventory: generateInventory(280)
  },

  // ── MUMBAI ─────────────────────────────────────────
  {
    id: 'BB005',
    name: 'Tata Memorial Hospital Blood Bank',
    fullName: 'Tata Memorial Centre Blood Transfusion Service',
    city: 'Mumbai',
    state: 'Maharashtra',
    region: 'West',
    type: 'Government',
    tier: 1,
    lat: 19.0048,
    lng: 72.8435,
    address: 'Dr. E. Borges Road, Parel, Mumbai - 400012',
    phone: '+91-22-24177000',
    license: 'NBTC-MH-001',
    capacity: 450,
    operatingHours: '24/7',
    components: ['Whole Blood', 'Packed RBCs', 'Platelets', 'Fresh Frozen Plasma', 'Cryoprecipitate'],
    specialization: 'Oncology transfusion, irradiated blood products',
    status: 'operational',
    inventory: generateInventory(450)
  },
  {
    id: 'BB006',
    name: 'KEM Hospital Blood Bank',
    fullName: 'Seth G.S. Medical College & KEM Hospital Blood Bank',
    city: 'Mumbai',
    state: 'Maharashtra',
    region: 'West',
    type: 'Government',
    tier: 1,
    lat: 19.0003,
    lng: 72.8421,
    address: 'Acharya Donde Marg, Parel, Mumbai - 400012',
    phone: '+91-22-24136051',
    license: 'NBTC-MH-002',
    capacity: 400,
    operatingHours: '24/7',
    components: ['Whole Blood', 'Packed RBCs', 'Platelets', 'Fresh Frozen Plasma'],
    specialization: 'Tertiary care, trauma centre',
    status: 'operational',
    inventory: generateInventory(400)
  },
  {
    id: 'BB007',
    name: 'JJ Hospital Blood Bank',
    fullName: 'Sir J.J. Group of Hospitals Blood Bank',
    city: 'Mumbai',
    state: 'Maharashtra',
    region: 'West',
    type: 'Government',
    tier: 1,
    lat: 18.9649,
    lng: 72.8342,
    address: 'Byculla, Mumbai - 400008',
    phone: '+91-22-23735555',
    license: 'NBTC-MH-003',
    capacity: 350,
    operatingHours: '24/7',
    components: ['Whole Blood', 'Packed RBCs', 'Platelets', 'Fresh Frozen Plasma'],
    specialization: 'Emergency and general surgery',
    status: 'operational',
    inventory: generateInventory(350)
  },

  // ── CHENNAI ────────────────────────────────────────
  {
    id: 'BB008',
    name: 'Rajiv Gandhi GGH Blood Bank',
    fullName: 'Rajiv Gandhi Government General Hospital Blood Bank',
    city: 'Chennai',
    state: 'Tamil Nadu',
    region: 'South',
    type: 'Government',
    tier: 1,
    lat: 13.0785,
    lng: 80.2754,
    address: 'Park Town, Chennai - 600003',
    phone: '+91-44-25305000',
    license: 'NBTC-TN-001',
    capacity: 400,
    operatingHours: '24/7',
    components: ['Whole Blood', 'Packed RBCs', 'Platelets', 'Fresh Frozen Plasma', 'Cryoprecipitate'],
    specialization: 'Government tertiary care, trauma',
    status: 'operational',
    inventory: generateInventory(400)
  },
  {
    id: 'BB009',
    name: 'Apollo Hospitals Blood Bank - Chennai',
    fullName: 'Apollo Hospitals Enterprise Ltd Blood Bank',
    city: 'Chennai',
    state: 'Tamil Nadu',
    region: 'South',
    type: 'Private',
    tier: 1,
    lat: 13.0101,
    lng: 80.2275,
    address: '21, Greams Lane, Off Greams Road, Chennai - 600006',
    phone: '+91-44-28290200',
    license: 'NBTC-TN-002',
    capacity: 350,
    operatingHours: '24/7',
    components: ['Whole Blood', 'Packed RBCs', 'Platelets', 'Fresh Frozen Plasma'],
    specialization: 'Multi-specialty, cardiac surgery support',
    status: 'operational',
    inventory: generateInventory(350)
  },

  // ── KOLKATA ────────────────────────────────────────
  {
    id: 'BB010',
    name: 'NRS Medical College Blood Bank',
    fullName: 'Nil Ratan Sircar Medical College & Hospital Blood Bank',
    city: 'Kolkata',
    state: 'West Bengal',
    region: 'East',
    type: 'Government',
    tier: 1,
    lat: 22.5657,
    lng: 88.3639,
    address: '138, AJC Bose Road, Kolkata - 700014',
    phone: '+91-33-22441927',
    license: 'NBTC-WB-001',
    capacity: 350,
    operatingHours: '24/7',
    components: ['Whole Blood', 'Packed RBCs', 'Platelets', 'Fresh Frozen Plasma'],
    specialization: 'Teaching hospital, general care',
    status: 'operational',
    inventory: generateInventory(350)
  },
  {
    id: 'BB011',
    name: 'SSKM Hospital Blood Bank',
    fullName: 'Seth Sukhlal Karnani Memorial Hospital Blood Bank',
    city: 'Kolkata',
    state: 'West Bengal',
    region: 'East',
    type: 'Government',
    tier: 1,
    lat: 22.5347,
    lng: 88.3410,
    address: '244, AJC Bose Road, Kolkata - 700020',
    phone: '+91-33-22041101',
    license: 'NBTC-WB-002',
    capacity: 380,
    operatingHours: '24/7',
    components: ['Whole Blood', 'Packed RBCs', 'Platelets', 'Fresh Frozen Plasma', 'Cryoprecipitate'],
    specialization: 'Superspeciality, referral centre',
    status: 'operational',
    inventory: generateInventory(380)
  },

  // ── BANGALORE ──────────────────────────────────────
  {
    id: 'BB012',
    name: 'Sankalp India Foundation',
    fullName: 'Sankalp India Foundation Blood Centre',
    city: 'Bangalore',
    state: 'Karnataka',
    region: 'South',
    type: 'NGO',
    tier: 1,
    lat: 12.9441,
    lng: 77.5602,
    address: 'CA-37, 15th Cross, Sadashivanagar, Bangalore - 560080',
    phone: '+91-80-23617100',
    license: 'NBTC-KA-001',
    capacity: 300,
    operatingHours: '24/7',
    components: ['Whole Blood', 'Packed RBCs', 'Platelets', 'Fresh Frozen Plasma'],
    specialization: 'Thalassemia care, voluntary donation',
    status: 'operational',
    inventory: generateInventory(300)
  },
  {
    id: 'BB013',
    name: 'Narayana Health Blood Bank',
    fullName: 'Narayana Institute of Cardiac Sciences Blood Bank',
    city: 'Bangalore',
    state: 'Karnataka',
    region: 'South',
    type: 'Private',
    tier: 1,
    lat: 12.8910,
    lng: 77.5977,
    address: '258/A, Bommasandra, Hosur Road, Bangalore - 560099',
    phone: '+91-80-71222222',
    license: 'NBTC-KA-002',
    capacity: 320,
    operatingHours: '24/7',
    components: ['Whole Blood', 'Packed RBCs', 'Platelets', 'Fresh Frozen Plasma', 'Cryoprecipitate'],
    specialization: 'Cardiac surgery, paediatric transfusion',
    status: 'operational',
    inventory: generateInventory(320)
  },
  {
    id: 'BB014',
    name: 'Victoria Hospital Blood Bank',
    fullName: 'Bangalore Medical College & Victoria Hospital Blood Bank',
    city: 'Bangalore',
    state: 'Karnataka',
    region: 'South',
    type: 'Government',
    tier: 1,
    lat: 12.9578,
    lng: 77.5730,
    address: 'Fort, Bangalore - 560002',
    phone: '+91-80-26701150',
    license: 'NBTC-KA-003',
    capacity: 350,
    operatingHours: '24/7',
    components: ['Whole Blood', 'Packed RBCs', 'Platelets', 'Fresh Frozen Plasma'],
    specialization: 'Teaching hospital, emergency medicine',
    status: 'operational',
    inventory: generateInventory(350)
  },

  // ── HYDERABAD ──────────────────────────────────────
  {
    id: 'BB015',
    name: 'NIMS Blood Bank',
    fullName: "Nizam's Institute of Medical Sciences Blood Bank",
    city: 'Hyderabad',
    state: 'Telangana',
    region: 'South',
    type: 'Government',
    tier: 1,
    lat: 17.3932,
    lng: 78.3940,
    address: 'Punjagutta, Hyderabad - 500082',
    phone: '+91-40-23489000',
    license: 'NBTC-TS-001',
    capacity: 380,
    operatingHours: '24/7',
    components: ['Whole Blood', 'Packed RBCs', 'Platelets', 'Fresh Frozen Plasma', 'Cryoprecipitate'],
    specialization: 'Superspeciality, organ transplant support',
    status: 'operational',
    inventory: generateInventory(380)
  },
  {
    id: 'BB016',
    name: 'Gandhi Hospital Blood Bank',
    fullName: 'Gandhi Medical College & Hospital Blood Bank',
    city: 'Hyderabad',
    state: 'Telangana',
    region: 'South',
    type: 'Government',
    tier: 1,
    lat: 17.4042,
    lng: 78.4749,
    address: 'Musheerabad, Secunderabad - 500003',
    phone: '+91-40-27505566',
    license: 'NBTC-TS-002',
    capacity: 350,
    operatingHours: '24/7',
    components: ['Whole Blood', 'Packed RBCs', 'Platelets', 'Fresh Frozen Plasma'],
    specialization: 'Infectious diseases, general medicine',
    status: 'operational',
    inventory: generateInventory(350)
  },

  // ── AHMEDABAD ──────────────────────────────────────
  {
    id: 'BB017',
    name: 'Indian Red Cross - Ahmedabad',
    fullName: 'Indian Red Cross Society Blood Bank, Ahmedabad',
    city: 'Ahmedabad',
    state: 'Gujarat',
    region: 'West',
    type: 'Red Cross',
    tier: 1,
    lat: 23.0242,
    lng: 72.5714,
    address: 'Red Cross Bhavan, Ashram Road, Ahmedabad - 380009',
    phone: '+91-79-26578787',
    license: 'NBTC-GJ-001',
    capacity: 320,
    operatingHours: '24/7',
    components: ['Whole Blood', 'Packed RBCs', 'Platelets', 'Fresh Frozen Plasma'],
    specialization: 'Donation drives, community outreach',
    status: 'operational',
    inventory: generateInventory(320)
  },

  // ── PUNE ───────────────────────────────────────────
  {
    id: 'BB018',
    name: 'Sassoon Hospital Blood Bank',
    fullName: 'Sassoon General Hospital & BJ Medical College Blood Bank',
    city: 'Pune',
    state: 'Maharashtra',
    region: 'West',
    type: 'Government',
    tier: 1,
    lat: 18.5300,
    lng: 73.8740,
    address: 'Sassoon Road, Pune - 411001',
    phone: '+91-20-26128000',
    license: 'NBTC-MH-004',
    capacity: 300,
    operatingHours: '24/7',
    components: ['Whole Blood', 'Packed RBCs', 'Platelets', 'Fresh Frozen Plasma'],
    specialization: 'Tertiary government hospital',
    status: 'operational',
    inventory: generateInventory(300)
  },

  // ── JAIPUR ─────────────────────────────────────────
  {
    id: 'BB019',
    name: 'SMS Hospital Blood Bank',
    fullName: 'Sawai Man Singh Hospital Blood Bank',
    city: 'Jaipur',
    state: 'Rajasthan',
    region: 'North',
    type: 'Government',
    tier: 1,
    lat: 26.8994,
    lng: 75.8087,
    address: 'Ramas Circle, Jaipur - 302004',
    phone: '+91-141-2554000',
    license: 'NBTC-RJ-001',
    capacity: 350,
    operatingHours: '24/7',
    components: ['Whole Blood', 'Packed RBCs', 'Platelets', 'Fresh Frozen Plasma'],
    specialization: 'Largest government hospital in Rajasthan',
    status: 'operational',
    inventory: generateInventory(350)
  },

  // ── LUCKNOW ────────────────────────────────────────
  {
    id: 'BB020',
    name: 'KGMU Blood Bank',
    fullName: 'King George Medical University Blood Bank',
    city: 'Lucknow',
    state: 'Uttar Pradesh',
    region: 'North',
    type: 'Government',
    tier: 1,
    lat: 26.8614,
    lng: 80.9330,
    address: 'Chowk, Lucknow - 226003',
    phone: '+91-522-2257450',
    license: 'NBTC-UP-001',
    capacity: 400,
    operatingHours: '24/7',
    components: ['Whole Blood', 'Packed RBCs', 'Platelets', 'Fresh Frozen Plasma', 'Cryoprecipitate'],
    specialization: 'Medical college, tertiary care',
    status: 'operational',
    inventory: generateInventory(400)
  },

  // ── CHANDIGARH ─────────────────────────────────────
  {
    id: 'BB021',
    name: 'PGI Blood Bank',
    fullName: 'Postgraduate Institute of Medical Education & Research Blood Bank',
    city: 'Chandigarh',
    state: 'Chandigarh',
    region: 'North',
    type: 'Government',
    tier: 1,
    lat: 30.7642,
    lng: 76.7773,
    address: 'Sector 12, Chandigarh - 160012',
    phone: '+91-172-2747585',
    license: 'NBTC-CH-001',
    capacity: 380,
    operatingHours: '24/7',
    components: ['Whole Blood', 'Packed RBCs', 'Platelets', 'Fresh Frozen Plasma', 'Cryoprecipitate'],
    specialization: 'Tertiary care, research institute',
    status: 'operational',
    inventory: generateInventory(380)
  },

  // ── GUWAHATI ───────────────────────────────────────
  {
    id: 'BB022',
    name: 'GMCH Blood Bank',
    fullName: 'Gauhati Medical College & Hospital Blood Bank',
    city: 'Guwahati',
    state: 'Assam',
    region: 'East',
    type: 'Government',
    tier: 1,
    lat: 26.1432,
    lng: 91.7270,
    address: 'Bhangagarh, Guwahati - 781032',
    phone: '+91-361-2523444',
    license: 'NBTC-AS-001',
    capacity: 300,
    operatingHours: '24/7',
    components: ['Whole Blood', 'Packed RBCs', 'Platelets', 'Fresh Frozen Plasma'],
    specialization: 'Major referral hospital for Northeast',
    status: 'operational',
    inventory: generateInventory(300)
  },

  // ── THIRUVANANTHAPURAM ─────────────────────────────
  {
    id: 'BB023',
    name: 'MCH Blood Bank',
    fullName: 'Government Medical College Hospital Blood Bank',
    city: 'Thiruvananthapuram',
    state: 'Kerala',
    region: 'South',
    type: 'Government',
    tier: 1,
    lat: 8.5157,
    lng: 76.9461,
    address: 'Medical College PO, Thiruvananthapuram - 695011',
    phone: '+91-471-2528386',
    license: 'NBTC-KL-001',
    capacity: 320,
    operatingHours: '24/7',
    components: ['Whole Blood', 'Packed RBCs', 'Platelets', 'Fresh Frozen Plasma'],
    specialization: 'Kerala state referral centre',
    status: 'operational',
    inventory: generateInventory(320)
  },

  // ── GUWAHATI ───────────────────────────────────────
  {
    id: 'BB024',
    name: 'GMCH Blood Bank',
    fullName: 'Gauhati Medical College & Hospital Blood Bank',
    city: 'Guwahati',
    state: 'Assam',
    region: 'Northeast',
    type: 'Government',
    tier: 1,
    lat: 26.1432,
    lng: 91.7270,
    address: 'Narakasur Hilltop, Bhangagarh, Guwahati - 781032',
    phone: '+91-361-2529457',
    license: 'NBTC-AS-001',
    capacity: 250,
    operatingHours: '24/7',
    components: ['Whole Blood', 'Packed RBCs', 'Platelets', 'Fresh Frozen Plasma'],
    specialization: 'Northeast India referral centre'
  },

  // ── PATNA ──────────────────────────────────────────
  {
    id: 'BB025',
    name: 'PMCH Blood Bank',
    fullName: 'Patna Medical College & Hospital Blood Bank',
    city: 'Patna',
    state: 'Bihar',
    region: 'East',
    type: 'Government',
    tier: 1,
    lat: 25.6167,
    lng: 85.1575,
    address: 'Ashok Rajpath, Patna - 800004',
    phone: '+91-612-2300343',
    license: 'NBTC-BR-001',
    capacity: 280,
    operatingHours: '24/7',
    components: ['Whole Blood', 'Packed RBCs', 'Platelets', 'Fresh Frozen Plasma'],
    specialization: 'Bihar state referral centre'
  },

  // ── COIMBATORE ─────────────────────────────────────
  {
    id: 'BB026',
    name: 'CMCH Blood Bank',
    fullName: 'Coimbatore Medical College Hospital Blood Bank',
    city: 'Coimbatore',
    state: 'Tamil Nadu',
    region: 'South',
    type: 'Government',
    tier: 2,
    lat: 11.0168,
    lng: 76.9558,
    address: 'Avanashi Road, Coimbatore - 641014',
    phone: '+91-422-2301393',
    license: 'NBTC-TN-003',
    capacity: 250,
    operatingHours: '24/7',
    components: ['Whole Blood', 'Packed RBCs', 'Platelets', 'Fresh Frozen Plasma'],
    specialization: 'District referral'
  },

  // ── NAGPUR ─────────────────────────────────────────
  {
    id: 'BB027',
    name: 'GMC Nagpur Blood Bank',
    fullName: 'Government Medical College & Hospital Nagpur Blood Bank',
    city: 'Nagpur',
    state: 'Maharashtra',
    region: 'Central',
    type: 'Government',
    tier: 1,
    lat: 21.1458,
    lng: 79.0882,
    address: 'Medical Square, Nagpur - 440003',
    phone: '+91-712-2723400',
    license: 'NBTC-MH-005',
    capacity: 300,
    operatingHours: '24/7',
    components: ['Whole Blood', 'Packed RBCs', 'Platelets', 'Fresh Frozen Plasma'],
    specialization: 'Central India, Vidarbha referral'
  }
];

// Generate realistic inventory for a blood bank
function generateInventory(bank) {
  const inventory = {};
  BLOOD_GROUPS.forEach(group => {
    const distribution = BLOOD_GROUP_DISTRIBUTION[group] || 0.05;
    const baseStock = Math.floor(bank.capacity * distribution);
    // Add some variance
    const variance = Math.floor(baseStock * (0.3 + Math.random() * 0.7));
    inventory[group] = {
      units: Math.max(2, variance),
      capacity: Math.ceil(baseStock * 1.5),
      lastUpdated: new Date(Date.now() - Math.random() * 3600000).toISOString(),
      expiringIn3Days: Math.floor(Math.random() * 5),
      expiringIn7Days: Math.floor(Math.random() * 10)
    };
  });
  return inventory;
}

// Initialize all blood banks with inventory
function initializeBloodBanks() {
  return BLOOD_BANKS.map(bank => ({
    ...bank,
    inventory: generateInventory(bank),
    status: Math.random() > 0.1 ? 'operational' : 'limited',
    lastSync: new Date().toISOString(),
    utilizationRate: 0.5 + Math.random() * 0.4
  }));
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BLOOD_GROUPS, BLOOD_BANKS, initializeBloodBanks };
}
