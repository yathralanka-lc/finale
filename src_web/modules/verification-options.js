const DEFAULT_DESCRIPTIONS = Object.freeze({
  1: 'Frontal landmark view aligned with the principal entrance and surrounding architectural boundaries.',
  2: 'Secondary perspective capturing the landmark structure and its distinguishing architectural details.',
  3: 'Alternative checkpoint angle aligned with the visible landmark boundaries.'
});

export function getLandmarkVerificationOption(site, optionNum) {
  const number = Number(optionNum) || 1;
  const configured = Array.isArray(site?.verificationOptions)
    ? site.verificationOptions.find(option => Number(option.number) === number)
    : null;
  if (configured) return {
    number,
    title: configured.title || `Image Option ${number}`,
    description: configured.description || 'Align the live camera view with the reference image.',
    image: configured.image || site.image,
    fitAxis: configured.fitAxis === 'vertical' ? 'vertical' : 'horizontal'
  };
  return {
    number,
    title: `Image Option ${number}`,
    description: DEFAULT_DESCRIPTIONS[number] || 'Align the live camera view with the reference image.',
    image: number === 1 ? '/assets/images/independence_option_1.jpg' : (site?.image || '/Element%20Pictures/Independence%20Memorial%20Hall.jpg'),
    fitAxis: 'horizontal'
  };
}
