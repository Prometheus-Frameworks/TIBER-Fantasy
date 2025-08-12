import { useFounderMode } from "../hooks/useFounderMode";
import { OTC_SIGNATURE } from "../../../shared/otcSignature";

export default function Footer() {
  const founderMode = useFounderMode();
  const stamp = import.meta.env.VITE_BUILD_SHA || "dev";
  return (
    <footer className="text-xs text-neutral-500 py-6">
      <div className="container mx-auto px-4">
        {founderMode
          ? `Built by Architect J & Lamar — ${OTC_SIGNATURE.motto}. Build ${stamp}.`
          : `Built by the Duo — ${OTC_SIGNATURE.motto}. Build ${stamp}.`}
      </div>
    </footer>
  );
}