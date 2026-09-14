function loadReferenceImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Reference image could not be loaded.'));
    image.src = src;
  });
}

function drawCover(context, source, sourceWidth, sourceHeight, targetWidth, targetHeight) {
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = targetWidth / targetHeight;
  let sx = 0, sy = 0, sw = sourceWidth, sh = sourceHeight;
  if (sourceRatio > targetRatio) {
    sw = sourceHeight * targetRatio;
    sx = (sourceWidth - sw) / 2;
  } else {
    sh = sourceWidth / targetRatio;
    sy = (sourceHeight - sh) / 2;
  }
  context.drawImage(source, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);
}

function extractFeatures(imageData, width, height) {
  const pixels = imageData.data;
  const luma = new Float32Array(width * height);
  const histogram = new Float32Array(48);
  let lumaSum = 0;
  for (let i = 0, pixelIndex = 0; i < pixels.length; i += 4, pixelIndex++) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    const value = 0.299 * r + 0.587 * g + 0.114 * b;
    luma[pixelIndex] = value;
    lumaSum += value;
    histogram[Math.min(15, r >> 4)]++;
    histogram[16 + Math.min(15, g >> 4)]++;
    histogram[32 + Math.min(15, b >> 4)]++;
  }
  for (let i = 0; i < histogram.length; i++) histogram[i] /= width * height * 3;
  const edges = new Float32Array(width * height);
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const index = y * width + x;
      edges[index] = Math.hypot(luma[index + 1] - luma[index], luma[index + width] - luma[index]);
    }
  }
  const average = lumaSum / luma.length;
  const hash = [];
  const blockWidth = Math.max(1, Math.floor(width / 8));
  const blockHeight = Math.max(1, Math.floor(height / 8));
  for (let by = 0; by < 8; by++) for (let bx = 0; bx < 8; bx++) {
    let sum = 0, count = 0;
    for (let y = by * blockHeight; y < Math.min(height, (by + 1) * blockHeight); y++) {
      for (let x = bx * blockWidth; x < Math.min(width, (bx + 1) * blockWidth); x++) { sum += luma[y * width + x]; count++; }
    }
    hash.push((sum / Math.max(1, count)) >= average ? 1 : 0);
  }
  return { luma, edges, histogram, hash };
}

function correlation(left, right) {
  const length = Math.min(left.length, right.length);
  if (!length) return 0;
  let leftMean = 0, rightMean = 0;
  for (let i = 0; i < length; i++) { leftMean += left[i]; rightMean += right[i]; }
  leftMean /= length; rightMean /= length;
  let numerator = 0, leftVariance = 0, rightVariance = 0;
  for (let i = 0; i < length; i++) {
    const leftDelta = left[i] - leftMean, rightDelta = right[i] - rightMean;
    numerator += leftDelta * rightDelta; leftVariance += leftDelta ** 2; rightVariance += rightDelta ** 2;
  }
  const denominator = Math.sqrt(leftVariance * rightVariance);
  return denominator ? Math.max(-1, Math.min(1, numerator / denominator)) : 0;
}

function hogSimilarity(leftLuma, rightLuma, width, height, cells = 6, bins = 9) {
  const descriptor = luma => {
    const result = new Float32Array(cells * cells * bins);
    for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
      const index = y * width + x;
      const dx = luma[index + 1] - luma[index - 1], dy = luma[index + width] - luma[index - width];
      let angle = Math.atan2(dy, dx); if (angle < 0) angle += Math.PI; if (angle >= Math.PI) angle -= Math.PI;
      const cellX = Math.min(cells - 1, Math.floor(x / width * cells));
      const cellY = Math.min(cells - 1, Math.floor(y / height * cells));
      const bin = Math.min(bins - 1, Math.floor(angle / Math.PI * bins));
      result[(cellY * cells + cellX) * bins + bin] += Math.hypot(dx, dy);
    }
    for (let cell = 0; cell < cells * cells; cell++) {
      const offset = cell * bins;
      let magnitude = 0; for (let bin = 0; bin < bins; bin++) magnitude += result[offset + bin] ** 2;
      const normalizer = Math.sqrt(magnitude) + 0.000001;
      for (let bin = 0; bin < bins; bin++) result[offset + bin] /= normalizer;
    }
    return result;
  };
  const left = descriptor(leftLuma), right = descriptor(rightLuma);
  let dot = 0, leftMagnitude = 0, rightMagnitude = 0;
  for (let i = 0; i < left.length; i++) { dot += left[i] * right[i]; leftMagnitude += left[i] ** 2; rightMagnitude += right[i] ** 2; }
  const denominator = Math.sqrt(leftMagnitude * rightMagnitude);
  return denominator ? Math.max(0, Math.min(1, dot / denominator)) : 0;
}

export async function analyzeLandmarkPhoto(video, referenceImageSrc, overlayImage, minimumScore) {
  const sampleSize = 96;
  const capturedSample = document.createElement('canvas');
  capturedSample.width = sampleSize; capturedSample.height = sampleSize;
  const capturedContext = capturedSample.getContext('2d', { willReadFrequently: true });
  const videoRect = video.getBoundingClientRect();
  const overlayRect = overlayImage?.getBoundingClientRect?.();
  let referenceCrop = null;
  if (overlayRect && videoRect.width > 0 && videoRect.height > 0 && overlayRect.width > 0 && overlayRect.height > 0) {
    const scale = Math.max(videoRect.width / video.videoWidth, videoRect.height / video.videoHeight);
    const renderedWidth = video.videoWidth * scale, renderedHeight = video.videoHeight * scale;
    const offsetX = (renderedWidth - videoRect.width) / 2, offsetY = (renderedHeight - videoRect.height) / 2;
    const left = Math.max(videoRect.left, overlayRect.left), top = Math.max(videoRect.top, overlayRect.top);
    const right = Math.min(videoRect.right, overlayRect.right), bottom = Math.min(videoRect.bottom, overlayRect.bottom);
    const sx = Math.max(0, (left - videoRect.left + offsetX) / scale), sy = Math.max(0, (top - videoRect.top + offsetY) / scale);
    const sw = Math.min(video.videoWidth - sx, Math.max(1, (right - left) / scale)), sh = Math.min(video.videoHeight - sy, Math.max(1, (bottom - top) / scale));
    capturedContext.drawImage(video, sx, sy, sw, sh, 0, 0, sampleSize, sampleSize);
    referenceCrop = { left: Math.max(0, Math.min(1, (left - overlayRect.left) / overlayRect.width)), top: Math.max(0, Math.min(1, (top - overlayRect.top) / overlayRect.height)), width: Math.max(.001, Math.min(1, (right - left) / overlayRect.width)), height: Math.max(.001, Math.min(1, (bottom - top) / overlayRect.height)) };
  } else drawCover(capturedContext, video, video.videoWidth, video.videoHeight, sampleSize, sampleSize);
  const referenceImage = await loadReferenceImage(referenceImageSrc);
  const referenceSample = document.createElement('canvas'); referenceSample.width = sampleSize; referenceSample.height = sampleSize;
  const referenceContext = referenceSample.getContext('2d', { willReadFrequently: true });
  if (referenceCrop) referenceContext.drawImage(referenceImage, referenceCrop.left * referenceImage.naturalWidth, referenceCrop.top * referenceImage.naturalHeight, Math.min(referenceImage.naturalWidth - referenceCrop.left * referenceImage.naturalWidth, referenceCrop.width * referenceImage.naturalWidth), Math.min(referenceImage.naturalHeight - referenceCrop.top * referenceImage.naturalHeight, referenceCrop.height * referenceImage.naturalHeight), 0, 0, sampleSize, sampleSize);
  else drawCover(referenceContext, referenceImage, referenceImage.naturalWidth, referenceImage.naturalHeight, sampleSize, sampleSize);
  const captured = extractFeatures(capturedContext.getImageData(0, 0, sampleSize, sampleSize), sampleSize, sampleSize);
  const reference = extractFeatures(referenceContext.getImageData(0, 0, sampleSize, sampleSize), sampleSize, sampleSize);
  const shape = hogSimilarity(captured.luma, reference.luma, sampleSize, sampleSize);
  const structure = Math.max((correlation(captured.luma, reference.luma) + 1) / 2, shape);
  const outline = Math.max((correlation(captured.edges, reference.edges) + 1) / 2, Math.min(1, shape * .78));
  let color = 0; for (let i = 0; i < captured.histogram.length; i++) color += Math.min(captured.histogram[i], reference.histogram[i]);
  let bits = 0; for (let i = 0; i < captured.hash.length; i++) if (captured.hash[i] === reference.hash[i]) bits++;
  const framing = bits / captured.hash.length;
  const score = Math.max(0, Math.min(100, Math.round((structure * .34 + outline * .28 + Math.min(1, color) * .23 + framing * .15) * 100)));
  return { score, passed: score >= minimumScore, comparisonDataUrl: capturedSample.toDataURL('image/jpeg', .9), referenceComparisonDataUrl: referenceSample.toDataURL('image/jpeg', .9), metrics: { structure: Math.round(structure * 100), outline: Math.round(outline * 100), color: Math.round(Math.min(1, color) * 100), framing: Math.round(framing * 100) } };
}
