import { Platform } from 'react-native';

const PRODUCTION_URL = 'https://village-backend-802022146719.us-central1.run.app';

// On web in dev, use localhost so you can test against a local backend.
// On native (phone/simulator), always use the hosted backend.
export const API_URL = (__DEV__ && Platform.OS === 'web')
  ? 'http://localhost:3000'
  : PRODUCTION_URL;

export const WS_URL = API_URL.replace(/^http/, 'ws') + '/ws';