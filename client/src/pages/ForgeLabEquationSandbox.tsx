import { useState, useMemo, useCallback } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, Copy, Check, FlaskConical } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { FORGE_LAB_EQUATIONS, getEquationById, type ForgeLabEquation, type ForgeLabInputDef } from '../forgeLab/equations';

function InputSlider({
  def,
  value,
  onChange,
}: {
  def: ForgeLabInputDef;
  value: number;
  onChange: (val: number) => void;
}) {
  const handleSliderChange = useCallback((vals: number[]) => {
    onChange(vals[0]);
  }, [onChange]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseFloat(e.target.value);
    if (!isNaN(parsed)) {
      const clamped = Math.max(def.min, Math.min(def.max, parsed));
      onChange(clamped);
    }
  }, [def.min, def.max, onChange]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm text-gray-300">{def.label}</Label>
        <Input
          type="number"
          min={def.min}
          max={def.max}
          step={def.step}
          value={value}
          onChange={handleInputChange}
          className="w-24 h-8 text-right bg-[#1a1f2e] border-gray-700 text-white"
          data-testid={`input-${def.key}`}
        />
      </div>
      <Slider
        min={def.min}
        max={def.max}
        step={def.step}
        value={[value]}
        onValueChange={handleSliderChange}
        className="w-full"
        data-testid={`slider-${def.key}`}
      />
      <div className="flex justify-between text-xs text-gray-500">
        <span>{def.min}</span>
        <span>{def.max}</span>
      </div>
    </div>
  );
}

function OutputCard({ outputs }: { outputs: Record<string, number> }) {
  return (
    <Card className="bg-[#141824] border-gray-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-white flex items-center gap-2">
          <Badge className="bg-emerald-600 text-white">Outputs</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(outputs).map(([key, val]) => (
            <div key={key} className="bg-[#0a0e1a] rounded-lg p-3 border border-gray-800">
              <div className="text-xs text-gray-400 mb-1">{key}</div>
              <div className="text-xl font-mono text-white" data-testid={`output-${key}`}>
                {typeof val === 'number' ? val.toFixed(4) : val}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function StepsCard({ steps }: { steps: string[] }) {
  return (
    <Card className="bg-[#141824] border-gray-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-white flex items-center gap-2">
          <Badge className="bg-blue-600 text-white">Calculation Steps</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1 font-mono text-sm">
          {steps.map((step, i) => (
            <div
              key={i}
              className={step === '' ? 'h-2' : 'text-gray-300 bg-[#0a0e1a] rounded px-3 py-1.5 border border-gray-800'}
              data-testid={`step-${i}`}
            >
              {step}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function JsonExportCard({
  inputs,
  outputs,
}: {
  inputs: Record<string, number>;
  outputs: Record<string, number>;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const jsonData = useMemo(() => ({
    inputs,
    derived: outputs,
  }), [inputs, outputs]);

  const jsonString = useMemo(() => JSON.stringify(jsonData, null, 2), [jsonData]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      toast({ title: 'Copied to clipboard', description: 'JSON data copied successfully' });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({ title: 'Copy failed', description: 'Could not copy to clipboard', variant: 'destructive' });
    }
  }, [jsonString, toast]);

  return (
    <Card className="bg-[#141824] border-gray-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-white flex items-center gap-2">
            <Badge className="bg-purple-600 text-white">JSON Export</Badge>
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
            data-testid="button-copy-json"
          >
            {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
            {copied ? 'Copied' : 'Copy JSON'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <pre className="bg-[#0a0e1a] rounded-lg p-4 border border-gray-800 text-xs text-gray-300 overflow-x-auto">
          {jsonString}
        </pre>
      </CardContent>
    </Card>
  );
}

export default function ForgeLabEquationSandbox() {
  const [selectedEquationId, setSelectedEquationId] = useState<string>(FORGE_LAB_EQUATIONS[0]?.id ?? '');
  const selectedEquation = useMemo(() => getEquationById(selectedEquationId), [selectedEquationId]);

  const [inputValues, setInputValues] = useState<Record<string, number>>(() => {
    const eq = FORGE_LAB_EQUATIONS[0];
    if (!eq) return {};
    return eq.inputs.reduce((acc, input) => {
      acc[input.key] = input.defaultValue;
      return acc;
    }, {} as Record<string, number>);
  });

  const handleEquationChange = useCallback((eqId: string) => {
    setSelectedEquationId(eqId);
    const eq = getEquationById(eqId);
    if (eq) {
      const defaults = eq.inputs.reduce((acc, input) => {
        acc[input.key] = input.defaultValue;
        return acc;
      }, {} as Record<string, number>);
      setInputValues(defaults);
    }
  }, []);

  const handleInputChange = useCallback((key: string, val: number) => {
    setInputValues((prev) => ({ ...prev, [key]: val }));
  }, []);

  const computeResult = useMemo(() => {
    if (!selectedEquation) return { outputs: {}, steps: [] };
    return selectedEquation.compute(inputValues);
  }, [selectedEquation, inputValues]);

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/dev/forge">
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white" data-testid="button-back">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <FlaskConical className="h-6 w-6 text-purple-400" />
              <h1 className="text-2xl font-bold text-white">FORGE Lab</h1>
              <Badge className="bg-yellow-600 text-white text-xs">Admin Sandbox</Badge>
            </div>
          </div>
        </div>

        <Card className="bg-[#141824] border-gray-800 mb-6">
          <CardHeader>
            <CardTitle className="text-white">Equation Selector</CardTitle>
            <CardDescription className="text-gray-400">
              Select an equation to explore and adjust its parameters
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedEquationId} onValueChange={handleEquationChange}>
              <SelectTrigger className="w-full md:w-96 bg-[#1a1f2e] border-gray-700 text-white" data-testid="select-equation">
                <SelectValue placeholder="Select equation..." />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1f2e] border-gray-700">
                {FORGE_LAB_EQUATIONS.map((eq) => (
                  <SelectItem key={eq.id} value={eq.id} className="text-white hover:bg-gray-800">
                    {eq.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedEquation && (
              <p className="mt-3 text-sm text-gray-400">{selectedEquation.description}</p>
            )}
          </CardContent>
        </Card>

        {selectedEquation && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <Card className="bg-[#141824] border-gray-800">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Badge className="bg-orange-600 text-white">Inputs</Badge>
                  </CardTitle>
                  <CardDescription className="text-gray-400">
                    Adjust the input parameters using sliders or direct input
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {selectedEquation.inputs.map((inputDef) => (
                    <InputSlider
                      key={inputDef.key}
                      def={inputDef}
                      value={inputValues[inputDef.key] ?? inputDef.defaultValue}
                      onChange={(val) => handleInputChange(inputDef.key, val)}
                    />
                  ))}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <OutputCard outputs={computeResult.outputs} />
              <StepsCard steps={computeResult.steps} />
              <JsonExportCard inputs={inputValues} outputs={computeResult.outputs} />
            </div>
          </div>
        )}

        {/* TODO: Player-Linked Mode
          Future enhancement: Add player dropdown to auto-fetch input defaults from FORGE context APIs.
          This will allow testing equations with real player data.
        */}
      </div>
    </div>
  );
}
