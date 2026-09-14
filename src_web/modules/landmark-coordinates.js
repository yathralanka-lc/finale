const FALLBACK_COORDINATES = Object.freeze({ lat: 7.8731, lng: 80.7718 });

export const SITE_COORDINATES_MAP = Object.freeze({
  bmich: { lat: 6.9016667, lng: 79.8727778 },
  colombo_museum: { lat: 6.91041, lng: 79.86097 },
  national_museum: { lat: 6.91041, lng: 79.86097 },
  independence_memorial_hall: { lat: 6.90413, lng: 79.86758 },
  independence_hall: { lat: 6.90413, lng: 79.86758 },
  ladies_college_colombo: { lat: 6.9072, lng: 79.8575 },
  sigiriya: { lat: 7.9570, lng: 80.7603 },
  temple_of_the_tooth: { lat: 7.2936, lng: 80.6413 },
  temple_of_tooth: { lat: 7.2936, lng: 80.6413 },
  kandy_tooth: { lat: 7.2936, lng: 80.6413 },
  ruwanweliseya: { lat: 8.3503, lng: 80.3962 },
  mihintale: { lat: 8.3508, lng: 80.5186 },
  galle_fort: { lat: 6.0279875, lng: 80.2175781 },
  dambulla: { lat: 7.8567, lng: 80.6483 },
  dambulla_cave: { lat: 7.8567, lng: 80.6483 },
  ritigala: { lat: 8.1139, lng: 80.6558 },
  ritigala_monastery: { lat: 8.1139, lng: 80.6558 },
  dowa_temple: { lat: 6.8202, lng: 81.0255 },
  dowa_rock_temple: { lat: 6.8202, lng: 81.0255 },
  yudaganawa: { lat: 6.7292, lng: 81.2831 },
  pilikuttuwa: { lat: 6.8465, lng: 79.9933 },
  maligawila: { lat: 6.7352, lng: 81.3392 },
  buduruwagala: { lat: 6.6908, lng: 81.0772 }
});

export function resolveSiteCoordinates(site) {
  if (!site) return { ...FALLBACK_COORDINATES };
  if (typeof site.lat === 'number' && typeof site.lng === 'number') return { lat: site.lat, lng: site.lng };
  if (typeof site.latitude === 'number' && typeof site.longitude === 'number') return { lat: site.latitude, lng: site.longitude };
  if (Array.isArray(site.coordinates) && site.coordinates.length >= 2) return { lat: Number(site.coordinates[0]), lng: Number(site.coordinates[1]) };
  if (site.location && typeof site.location.lat === 'number' && typeof site.location.lng === 'number') return { lat: site.location.lat, lng: site.location.lng };

  const keys = [
    String(site.id || '').toLowerCase().trim(),
    String(site.slug || '').toLowerCase().trim(),
    String(site.name || '').toLowerCase().replace(/[^a-z0-9]/g, '_'),
    String(site.name || '').toLowerCase().replace(/\s+/g, '_')
  ];
  for (const key of keys) {
    if (SITE_COORDINATES_MAP[key]) return { ...SITE_COORDINATES_MAP[key] };
    for (const [mapKey, coordinates] of Object.entries(SITE_COORDINATES_MAP)) {
      if (key.includes(mapKey) || mapKey.includes(key)) return { ...coordinates };
    }
  }
  return { ...FALLBACK_COORDINATES };
}
