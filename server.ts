import path from "node:path";
import app from "./artifacts/api-server/src/app";

const frontendEntry = path.resolve(
  process.cwd(),
  "artifacts/gwiza-research/dist/public/index.html",
);

app.use((request, response, next) => {
  if (request.method !== "GET" || request.path === "/api" || request.path.startsWith("/api/")) {
    next();
    return;
  }

  response.sendFile(frontendEntry, (error) => {
    if (error && !response.headersSent) next(error);
  });
});

export default app;
