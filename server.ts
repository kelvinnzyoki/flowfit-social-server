import app from './app';
import { env } from './config/env';

app.listen(env.PORT, () => {
  console.log(`FlowFit social server listening on port ${env.PORT}`);
});
