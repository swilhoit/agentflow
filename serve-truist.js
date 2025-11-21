#!/usr/bin/env node

/**
 * Simple HTTP server to serve Teller Connect page
 * Fixes the "Invalid target origin 'null'" error
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const HTML_FILE = path.join(__dirname, 'connect-truist.html');

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/connect-truist.html') {
    fs.readFile(HTML_FILE, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error loading page');
        return;
      }
      
      res.writeHead(200, { 
        'Content-Type': 'text/html',
        'Cache-Control': 'no-cache'
      });
      res.end(data);
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('   🏦 Teller Connect Server Running');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log(`   🌐 Open: http://localhost:${PORT}`);
  console.log('');
  console.log('   1. Click "Connect Truist Now" button');
  console.log('   2. Search for "Truist"');
  console.log('   3. Enter your credentials');
  console.log('   4. Done! ✅');
  console.log('');
  console.log('   Press Ctrl+C to stop the server');
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  
  // Auto-open browser
  const { exec } = require('child_process');
  exec(`open http://localhost:${PORT}`);
});

