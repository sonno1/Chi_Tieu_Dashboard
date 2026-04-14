import "dotenv/config";
import { getEnv } from "./env";
import app from "./app";

const env = getEnv();

app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${env.PORT}`);
});
