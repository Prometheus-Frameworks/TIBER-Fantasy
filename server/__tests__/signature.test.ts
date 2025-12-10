import request from "supertest";
import express from "express";
import { attachSignatureHeader } from "../middleware/signature";
import { TIBER_SIGNATURE } from "../../shared/tiberSignature";

const app = express();
app.use(attachSignatureHeader);

app.get("/api/signal", (req, res) => {
  res.json({
    status: "aligned",
    key: TIBER_SIGNATURE.key,
    motto: TIBER_SIGNATURE.motto,
  });
});

describe("TIBER Signature", () => {
  it("exposes signal endpoint and header", async () => {
    const res = await request(app).get("/api/signal");
    expect(res.status).toBe(200);
    expect(res.headers["x-tiber"]).toBe("TIBER-MIRROR");
    expect(res.body).toMatchObject({
      status: "aligned",
      key: "TIBER-MIRROR",
    });
  });
});