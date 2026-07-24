import 'dotenv/config';

import { createApp } from './app.js';
import { getEnv } from './config/env.js';

const env = getEnv();
const app = createApp();

app.listen(env.port, () => {
  console.log(`API server listening on http://127.0.0.1:${env.port}`);
});
