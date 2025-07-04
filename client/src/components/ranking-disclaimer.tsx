import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function RankingDisclaimer() {
  return (
    <Alert className="bg-blue-50 border-blue-200 mb-6">
      <AlertCircle className="h-4 w-4 text-blue-600" />
      <AlertDescription className="text-blue-800">
        <strong>Disclaimer:</strong> Rankings are generated using proprietary algorithms based on publicly available statistics. 
        This platform provides analytical tools for fantasy football research. All fantasy decisions are the user's responsibility. 
        Player values and rankings are estimates and should not be considered definitive.
      </AlertDescription>
    </Alert>
  );
}