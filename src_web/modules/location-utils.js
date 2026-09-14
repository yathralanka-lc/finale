export function isValidLocationCoordinatePair(position) {
  if (!position) return false;
  const latitude = Number(position.latitude);
  const longitude = Number(position.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude) &&
    latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

export function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const values = [lat1, lon1, lat2, lon2].map(Number);
  if (!values.every(Number.isFinite)) return Number.POSITIVE_INFINITY;
  const [fromLat, fromLon, toLat, toLon] = values;
  const earthRadiusMetres = 6371000;
  const deltaLat = (toLat - fromLat) * Math.PI / 180;
  const deltaLon = (toLon - fromLon) * Math.PI / 180;
  const a = Math.sin(deltaLat / 2) ** 2 +
    Math.cos(fromLat * Math.PI / 180) * Math.cos(toLat * Math.PI / 180) *
    Math.sin(deltaLon / 2) ** 2;
  return earthRadiusMetres * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function calculateHaversineDistanceMeters(lat1, lon1, lat2, lon2) {
  return Math.round(calculateDistanceMeters(lat1, lon1, lat2, lon2));
}

export function createLocationService({
  nativeGeolocation,
  browserGeolocation,
  getMaxAccuracyMeters,
  isValidPosition = isValidLocationCoordinatePair,
  savePosition,
  setPermissionDenied,
  notify
}) {
  let activeRequest = null;

  async function refresh({ showFeedback = false } = {}) {
    if (activeRequest) return activeRequest;
    activeRequest = (async () => {
      let bestPosition = null;
      let lastError = null;
      const record = coords => {
        const nextPosition = {
          latitude: Number(coords.latitude),
          longitude: Number(coords.longitude),
          accuracy: Number.isFinite(Number(coords.accuracy)) ? Number(coords.accuracy) : null,
          capturedAt: Date.now()
        };
        if (!isValidPosition(nextPosition)) throw new Error('The device returned an invalid location.');
        if (!bestPosition || !Number.isFinite(bestPosition.accuracy) ||
          (Number.isFinite(nextPosition.accuracy) && nextPosition.accuracy < bestPosition.accuracy)) {
          bestPosition = nextPosition;
        }
        savePosition(nextPosition);
        setPermissionDenied(false);
        return nextPosition;
      };

      if (showFeedback) notify?.('Getting your precise location. Please wait a moment.', 'info');
      try {
        let permission = await nativeGeolocation.checkPermissions();
        if (permission.location !== 'granted' && permission.coarseLocation !== 'granted') {
          permission = await nativeGeolocation.requestPermissions();
        }
        if (permission.location === 'granted' || permission.coarseLocation === 'granted') {
          const position = await nativeGeolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
          record(position.coords);
        } else {
          setPermissionDenied(true);
          throw new Error('Location permission was not granted.');
        }
      } catch (error) {
        lastError = error;
        console.warn('Native precise location unavailable:', error);
      }

      if ((!bestPosition || !Number.isFinite(bestPosition.accuracy) || bestPosition.accuracy > getMaxAccuracyMeters()) && browserGeolocation) {
        try {
          const browserPosition = await new Promise((resolve, reject) => browserGeolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true, timeout: 15000, maximumAge: 0
          }));
          record(browserPosition.coords);
        } catch (error) {
          lastError = error;
          console.warn('Browser precise location unavailable:', error);
        }
      }

      if (!isValidPosition(bestPosition)) {
        setPermissionDenied(true);
        notify?.('Your current location could not be read. Turn on Location and Precise Location for Yathra Lanka, then tap Try Again.', 'error');
        throw lastError || new Error('Current location unavailable.');
      }
      if (Number.isFinite(bestPosition.accuracy) && bestPosition.accuracy > getMaxAccuracyMeters()) {
        setPermissionDenied(false);
        throw new Error(`Location accuracy is only about ${Math.round(bestPosition.accuracy)} metres. Move to an open area and try again.`);
      }
      if (showFeedback) {
        const accuracyText = Number.isFinite(bestPosition.accuracy) ? ` Accuracy is about ${Math.round(bestPosition.accuracy)} metres.` : '';
        notify?.(`Location updated.${accuracyText}`, 'success');
      }
      return bestPosition;
    })();
    try {
      return await activeRequest;
    } finally {
      activeRequest = null;
    }
  }
  return { refresh };
}
