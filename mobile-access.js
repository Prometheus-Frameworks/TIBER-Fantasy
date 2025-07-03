// Simple production server for mobile access
const express = require('express');
const { createServer } = require('http');
const path = require('path');

const app = express();

// Enable CORS for mobile access
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Serve a simple redirect page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Fantasy Football App</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { 
          font-family: Arial, sans-serif; 
          text-align: center; 
          padding: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          min-height: 100vh;
          margin: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .container {
          background: rgba(255,255,255,0.1);
          padding: 30px;
          border-radius: 20px;
          backdrop-filter: blur(10px);
          max-width: 400px;
          margin: 0 auto;
        }
        .btn {
          background: #28a745;
          color: white;
          padding: 15px 30px;
          border: none;
          border-radius: 10px;
          font-size: 18px;
          text-decoration: none;
          display: inline-block;
          margin: 20px 0;
          box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        }
        .btn:hover {
          background: #218838;
          transform: translateY(-2px);
        }
        .url {
          background: rgba(0,0,0,0.2);
          padding: 15px;
          border-radius: 10px;
          margin: 20px 0;
          font-family: monospace;
          word-break: break-all;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🏈 Fantasy Football App</h1>
        <p>Your Sleeper team "H4MMER" with 30 players is ready!</p>
        
        <div class="url">
          Access your app at the Replit preview URL above
        </div>
        
        <p><strong>Features Ready:</strong><br>
        ✓ Team Analysis<br>
        ✓ Position Breakdown<br>
        ✓ Player Recommendations<br>
        ✓ Performance Charts</p>
        
        <p style="font-size: 14px; margin-top: 30px;">
          Add this page to your home screen for quick access!
        </p>
      </div>
    </body>
    </html>
  `);
});

const port = 3000;
app.listen(port, '0.0.0.0', () => {
  console.log(\`Mobile access server running on port \${port}\`);
});