/**
 * sdpProjectsData.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Source: CSV export of the CSR project register (not included in this demo)
 *
 * All 17 projects parsed from the CSV with their full details:
 * installments, phases, officers, beneficiaries, financials, location.
 *
 * Column mapping from CSV row 3:
 *   0  Sl No            1  Project Number       2  Project Name
 *   3  Funding Agency   4  Implementation Partner  5  Project Location
 *   6  Type of Project  7  Status               8  Project Components
 *   9  Duration        10  Start Date           11  End Date
 *  12  Total Beneficiaries  13 Beneficiaries completed  14 Project Value
 *  15  Fund Installments   16  Fund Status       17  Project Milestones
 *  18  UC target date  19  UC Status            20  Total Expense accounted
 *  21  Total Committed Expense  22  Fund Balance  23  Project Officer
 *  24  Field Team      25  Project Phase        26  Project Phase status
 *  27  Current activities  28  Pending activities  29  Pending Target Date
 *  30  Risk/Challenges  31  Weekly Report       32  Remarks
 */

/**
 * Coordinate lookup for Indian cities/districts present in the CSV.
 */
export const CITY_COORDS = {
  yelahanka: { lat: 13.1007, lng: 77.5963 },
  bangalore: { lat: 12.9716, lng: 77.5946 },
  bengaluru: { lat: 12.9716, lng: 77.5946 },
  giridh: { lat: 24.185, lng: 86.3037 },
  jharkhand: { lat: 23.6102, lng: 85.2799 },
  thiruvananthapuram: { lat: 8.5241, lng: 76.9366 },
  trivandrum: { lat: 8.5241, lng: 76.9366 },
  wayanad: { lat: 11.6854, lng: 76.132 },
  simdega: { lat: 22.6166, lng: 84.5124 },
  nilgiris: { lat: 11.4064, lng: 76.6932 },
  ooty: { lat: 11.4064, lng: 76.6932 },
  maharashtra: { lat: 19.7515, lng: 75.7139 },
  beed: { lat: 18.9876, lng: 75.7597 },
  konni: { lat: 9.0055, lng: 76.9421 },
  pathanamthitta: { lat: 9.2648, lng: 76.787 },
  kadapa: { lat: 14.4673, lng: 78.8242 },
  'andhra pradesh': { lat: 15.9129, lng: 79.74 },
  kanpur: { lat: 26.4499, lng: 80.3319 },
  'uttar pradesh': { lat: 26.8467, lng: 80.9462 },
  faridabad: { lat: 28.4089, lng: 77.3178 },
  haryana: { lat: 29.0588, lng: 76.0856 },
  bihar: { lat: 25.0961, lng: 85.3131 },
  kochi: { lat: 9.9312, lng: 76.2673 },
  kerala: { lat: 10.8505, lng: 76.2711 },
  lucknow: { lat: 26.8467, lng: 80.9462 },
  bhubaneswar: { lat: 20.2961, lng: 85.8245 },
  kolkata: { lat: 22.5726, lng: 88.3639 },
  delhi: { lat: 28.6139, lng: 77.209 },
  mumbai: { lat: 19.076, lng: 72.8777 },
  hyderabad: { lat: 17.385, lng: 78.4867 },
  ranchi: { lat: 23.6102, lng: 85.2799 },
  chennai: { lat: 13.0827, lng: 80.2707 },
}

/** Resolve a text location string -> { lat, lng, label } */
export const resolveCoords = (locationText) => {
  if (!locationText) return { lat: 20.5937, lng: 78.9629, label: 'India' }
  const lower = locationText.toLowerCase()
  for (const [key, coords] of Object.entries(CITY_COORDS)) {
    if (lower.includes(key)) return { ...coords, label: locationText }
  }
  return { lat: 20.5937, lng: 78.9629, label: locationText }
}

// ─────────────────────────────────────────────────────────────────────────────
// ALL PROJECTS — parsed from CSV
// ─────────────────────────────────────────────────────────────────────────────

// Demo build: sample project records removed. Shape is documented in the header above.
// Demo build: sample project records removed. Shape is documented in the header above.
export const SDP_PROJECTS = []

export const SDP_TYPES = [...new Set(SDP_PROJECTS.map((p) => p.type))].sort()
export const SDP_FUNDING_AGENCIES = [...new Set(SDP_PROJECTS.map((p) => p.funding_agency))].sort()
export const SDP_PARTNERS = [...new Set(SDP_PROJECTS.map((p) => p.implementing_partner))].sort()
export const SDP_STATUSES = ['Ongoing', 'Approved', 'Completed']
