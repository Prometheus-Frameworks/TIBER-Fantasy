export default function Teams() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-16">
          <h1 className="text-4xl font-bold text-slate-800 mb-4">Team Management</h1>
          <p className="text-xl text-slate-600 mb-8">
            Sync and analyze your fantasy teams
          </p>
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md mx-auto">
            <div className="text-6xl mb-4">🏗️</div>
            <h2 className="text-2xl font-semibold mb-4">Coming Soon</h2>
            <p className="text-gray-600 mb-6">
              We're building powerful team management tools to help you track and optimize your fantasy rosters across multiple leagues.
            </p>
            <a href="/" className="inline-block bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition-colors">
              ← Back to Home
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}