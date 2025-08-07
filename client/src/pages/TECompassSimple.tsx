import React from 'react';

export default function TECompassSimple() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold text-center mb-6">TE Compass Test Page</h1>
      <div className="text-center">
        <p>If you can see this page, the routing is working correctly.</p>
        <p>The issue was browser cache preventing the full TECompass component from loading.</p>
        <div className="mt-4">
          <button 
            onClick={() => window.location.reload()} 
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Hard Reload Page
          </button>
        </div>
      </div>
    </div>
  );
}