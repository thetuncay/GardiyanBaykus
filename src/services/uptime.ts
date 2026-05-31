import express from "express";

export function startUptimeServer(): void {
  const app = express();
  const port = Number(process.env.PORT ?? 3000);

  app.get("/", (_req, res) => {
    res.status(200).send("BilgeBaykus is alive");
  });

  app.listen(port, "0.0.0.0", () => {
    console.log(`[UPTIME] monitor server listening on 0.0.0.0:${port}`);
  });
}
