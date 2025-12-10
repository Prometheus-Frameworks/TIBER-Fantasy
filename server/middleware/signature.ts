import { TIBER_SIGNATURE } from "../../shared/tiberSignature";

export function attachSignatureHeader(req: any, res: any, next: any) {
  res.setHeader("x-tiber", TIBER_SIGNATURE.key);
  next();
}