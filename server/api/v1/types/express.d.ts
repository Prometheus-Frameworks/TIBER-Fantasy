import "express-serve-static-core";

declare module "express-serve-static-core" {
  interface Request {
    requestId?: string;
    tiberAuth?: {
      apiKeyId: string;
      tier: string;
      ownerLabel: string;
      rateLimitRpm: number;
    };
  }
}
