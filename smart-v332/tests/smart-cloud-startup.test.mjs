import test from 'node:test';import assert from 'node:assert/strict';import {startupMessage} from '../js/productionV2/smartCloudDiagnostics.mjs';
test('cloud permission is specific',()=>assert.match(startupMessage('cloud',{code:'permission-denied'}),/CLOUD_PERMISSION/));
test('profile permission is distinct',()=>assert.match(startupMessage('profile',{code:'permission-denied'}),/PROFILE_PERMISSION/));
test('offline is specific',()=>assert.match(startupMessage('cloud',{code:'unavailable'}),/Reconecte/));
