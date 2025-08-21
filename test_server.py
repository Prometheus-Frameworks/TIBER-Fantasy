#!/usr/bin/env python3
from flask import Flask, jsonify
import datetime as dt

app = Flask(__name__)

@app.route("/health")
def health():
    return {"status": "healthy", "timestamp": dt.datetime.now(dt.timezone.utc).isoformat()}

if __name__ == "__main__":
    print("Starting test server on port 8000...")
    app.run(host="0.0.0.0", port=8000, debug=False)