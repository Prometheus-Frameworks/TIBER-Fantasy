import { OTC_SIGNATURE } from "../../../shared/otcSignature";

export default function Footer() {
  const stamp = import.meta.env.VITE_BUILD_SHA || "dev";
  return (
    <footer className="text-xs text-neutral-500 py-6">
      <div className="container mx-auto px-4">
        Built by Architect J & Lamar — {OTC_SIGNATURE.motto}. Build {stamp}.
      </div>
    </footer>
  );
}