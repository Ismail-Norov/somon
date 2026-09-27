import 'dotenv/config';
import { createApp } from './app';
import { markOverdueAssignments } from './services/access';

const port = Number(process.env.PORT || 4000);
const app = createApp();

app.listen(port, () => {
  console.log(`Somon API listening on http://localhost:${port}`);
  markOverdueAssignments().catch(console.error);
  setInterval(() => {
    markOverdueAssignments().catch(console.error);
  }, 15 * 60 * 1000);
});
