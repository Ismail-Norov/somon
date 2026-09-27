import 'dotenv/config';
import { createApp } from './app';
import { markOverdueAssignments } from './services/access';
import { sendLessonReminders } from './services/reminders';

const port = Number(process.env.PORT || 4000);
const app = createApp();

function runJobs() {
  markOverdueAssignments().catch(console.error);
  sendLessonReminders().catch(console.error);
}

app.listen(port, () => {
  console.log(`Somon API listening on http://localhost:${port}`);
  runJobs();
  setInterval(() => markOverdueAssignments().catch(console.error), 15 * 60 * 1000);
  setInterval(() => sendLessonReminders().catch(console.error), 5 * 60 * 1000);
});
