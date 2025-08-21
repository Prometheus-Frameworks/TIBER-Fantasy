export default function SOSLegend(){
  return (
    <div className="mb-3 text-sm text-gray-600">
      <span className="inline-block px-2 py-1 mr-2 rounded bg-green-100 text-green-900">Green ≥ 67 (easy)</span>
      <span className="inline-block px-2 py-1 mr-2 rounded bg-yellow-100 text-yellow-900">Yellow 33–66 (neutral)</span>
      <span className="inline-block px-2 py-1 rounded bg-red-100 text-red-900">Red &lt; 33 (tough)</span>
    </div>
  );
}