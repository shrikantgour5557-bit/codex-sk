import dotenv from 'dotenv';
import { app } from './app.js';

dotenv.config();

const port = Number(process.env.PORT || 8080);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`FreeAdSpace API running on http://localhost:${port}`);
});
