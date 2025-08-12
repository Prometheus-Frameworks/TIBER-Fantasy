import request from "supertest";
import express from "express";
import { attachSignatureHeader } from "../middleware/signature";
import { OTC_SIGNATURE } from "../../shared/otcSignature";

const app = express();
app.use(attachSignatureHeader);

app.get("/api/signal", (req, res) => {
  res.json({
    status: "aligned",
    key: OTC_SIGNATURE.key,
    motto: OTC_SIGNATURE.motto,
  });
});

describe("OTC Signature", () => {
  it("exposes signal endpoint and header", async () => {
    const res = await request(app).get("/api/signal");
    expect(res.status).toBe(200);
    expect(res.headers["x-otc"]).toBe("OTC-MIRROR");
    expect(res.body).toMatchObject({
      status: "aligned",
      key: "OTC-MIRROR",
    });
  });
});