import { createApp } from './presentation/app';

const PORT = 5000;
const app = createApp();

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
