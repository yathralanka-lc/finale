import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const app = readFileSync(resolve(root, 'src_web/app.js'), 'utf8');
const data = readFileSync(resolve(root, 'src_web/data.js'), 'utf8');

const failures = [];
const warnings = [];

function requirePattern(name, source, pattern) {
  if (!pattern.test(source)) failures.push(`${name}: expected pattern was not found`);
}

function forbidPattern(name, source, pattern) {
  if (pattern.test(source)) failures.push(`${name}: forbidden pattern is still present`);
}

function countAssignments(name) {
  const pattern = new RegExp(`window\\.${name}\\s*=(?!=)`, 'g');
  return [...app.matchAll(pattern)].length;
}

requirePattern('central product rules', app, /const APP_RULES = Object\.freeze\(/);
requirePattern('rank definitions use shared scale', app, /const RANK_DEFINITIONS = rankingScale\.map\(/);
requirePattern('production Independence coordinates', data, /productionLatitude:\s*6\.90413[\s\S]*productionLongitude:\s*79\.86758/);
requirePattern('phone-test coordinate separation', data, /IS_PHONE_TEST_BUILD\s*\?\s*6\.906630\s*:\s*6\.90413/);
forbidPattern('hidden 50 XP floor', app, /50\s*\+\s*completionBonus/);
forbidPattern('welcome bonus event', app, /WELCOME_BONUS_AWARDED/);
const unconditionalStateInitializers = [...app.matchAll(/^window\.state\s*=\s*\{/gm)].length;
if (unconditionalStateInitializers !== 1) {
  failures.push(`application state: expected one unconditional initializer, found ${unconditionalStateInitializers}`);
}

for (const name of [
  'switchAuthSlider',
  'restoreAuthTabs',
  'openTargetFramingView',
  'initBackgroundImmersionTimer'
]) {
  const count = countAssignments(name);
  if (count > 1) warnings.push(`${name}: ${count} implementations remain`);
}

if (/window\.showPhotoComparisonResult\s*=(?!=)|window\.analyzeLandmarkPhoto\s*=(?!=)/.test(app)) {
  failures.push('guided camera: an active photo-comparison handler is still exposed');
}
requirePattern('guided camera completion handler', app, /window\.showPhotoGuideCompletionResult\s*=/);
if (/immutable ledger|blockchain/i.test(app)) warnings.push('Legacy ledger wording remains for removal from production paths');

console.log('Phase 2 baseline audit');
console.log(`Critical checks: ${failures.length === 0 ? 'PASS' : 'FAIL'}`);
warnings.forEach(item => console.log(`WARNING: ${item}`));
failures.forEach(item => console.error(`ERROR: ${item}`));

if (failures.length > 0) process.exitCode = 1;
