const FALLBACK_COORDINATES = Object.freeze({ lat: 7.8731, lng: 80.7718 });

export const SITE_COORDINATES_MAP = Object.freeze({
  bmich: { lat: 6.9016667, lng: 79.8727778 },
  colombo_museum: { lat: 6.91041, lng: 79.86097 },
  national_museum: { lat: 6.91041, lng: 79.86097 },
  independence_memorial_hall: { lat: 6.90413, lng: 79.86758 },
  independence_hall: { lat: 6.90413, lng: 79.86758 },
  sigiriya: { lat: 7.956944, lng: 80.759720 },
  temple_of_the_tooth: { lat: 7.2936, lng: 80.6414 },
  temple_of_tooth: { lat: 7.2936, lng: 80.6414 },
  kandy_tooth: { lat: 7.2936, lng: 80.6414 },
  ruwanweliseya: { lat: 8.34998, lng: 80.3964 },
  mihintale: { lat: 8.3593, lng: 80.5103 },
  galle_fort: { lat: 6.0279875, lng: 80.2175781 },
  dambulla: { lat: 7.8567, lng: 80.6483 },
  dambulla_cave: { lat: 7.8567, lng: 80.6483 },
  ritigala: { lat: 8.11833, lng: 80.66461 },
  ritigala_monastery: { lat: 8.11833, lng: 80.66461 },
  dowa_temple: { lat: 6.8564, lng: 81.0225 },
  dowa_rock_temple: { lat: 6.8564, lng: 81.0225 },
  yudaganawa: { lat: 6.77, lng: 81.23 },
  pilikuttuwa: { lat: 7.06394, lng: 80.05031 },
  maligawila: { lat: 6.7272, lng: 81.3501 },
  buduruwagala: { lat: 6.6847, lng: 81.0795 }
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
