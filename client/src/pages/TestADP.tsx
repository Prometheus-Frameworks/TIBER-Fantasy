export default function TestADP() {
  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-4xl font-bold text-green-600 mb-4">
          🎯 ADP Page Working!
        </h1>
        <p className="text-lg text-slate-600 mb-8">
          If you can see this page, the ADP navigation is working correctly.
        </p>
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-green-800 mb-3">Test Results:</h2>
          <ul className="text-left text-green-700 space-y-2">
            <li>✅ Route /adp is properly configured</li>
            <li>✅ Component loads successfully</li>
            <li>✅ Navigation from home page works</li>
          </ul>
        </div>
        <a 
          href="/" 
          className="inline-block mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          ← Back to Home
        </a>
      </div>
    </div>
  );
}