/* Global Jest setup for the frontend.
 *
 * CRA/react-scripts provides Jest + jsdom out of the box; this file wires up
 * the React 19 act() environment and per-test cleanup (no extra dev
 * dependencies are required).
 */
import { cleanupTests } from './testUtils';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// react-router v7 needs TextEncoder/TextDecoder, which jest 27's jsdom lacks.
const { TextEncoder, TextDecoder } = require('util');
if (typeof globalThis.TextEncoder === 'undefined') globalThis.TextEncoder = TextEncoder;
if (typeof globalThis.TextDecoder === 'undefined') globalThis.TextDecoder = TextDecoder;

beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
  delete window.google;
  process.env.REACT_APP_GOOGLE_CLIENT_ID = '';
  process.env.REACT_APP_BACKEND_URL = '';
});

afterEach(async () => {
  await cleanupTests();
  sessionStorage.clear();
});
