export default function SOSLegend(){
  return (
    <div className="mb-3 text-sm text-gray-600">
      <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
        <span className="inline-block px-2 py-1 rounded bg-green-100 text-green-900 text-xs sm:text-sm">Green ≥ 67 (easy)</span>
        <span className="inline-block px-2 py-1 rounded bg-yellow-100 text-yellow-900 text-xs sm:text-sm">Yellow 33–66 (neutral)</span>
        <span className="inline-block px-2 py-1 rounded bg-red-100 text-red-900 text-xs sm:text-sm">Red &lt; 33 (tough)</span>
      </div>
    </div>
  );
}