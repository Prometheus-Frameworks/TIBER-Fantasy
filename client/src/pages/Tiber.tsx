import TiberChat from "@/components/TiberChat";
import { Brain } from "lucide-react";

export default function Tiber() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Brain className="h-6 w-6 text-plum" />
          <h1 className="text-2xl font-bold text-ink">Tiber</h1>
        </div>
        <p className="text-body max-w-2xl mx-auto">
          Your truth-first fantasy football reality check. Get blunt, evidence-based advice 
          that prioritizes accuracy over agreement.
        </p>
      </div>

      <TiberChat />
    </div>
  );
}