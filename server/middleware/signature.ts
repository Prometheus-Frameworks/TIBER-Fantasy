import { OTC_SIGNATURE } from "../../shared/otcSignature";

export function attachSignatureHeader(req: any, res: any, next: any) {
  res.setHeader("x-otc", OTC_SIGNATURE.key);
  next();
}