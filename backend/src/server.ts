import { app } from './app';
import { env } from './config/env';

app.listen(env.PORT, () => {                                // démarre le serveur HTTP
  console.log(`NeuroGrid API running on http://localhost:${env.PORT}/api`);
});
