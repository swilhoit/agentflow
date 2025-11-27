#!/bin/bash
# Run all migration batches using the Supabase MCP tool
# This script outputs SQL for each batch to be executed

cd /Volumes/LaCie/WEBDEV/agentflow

# Read the batches JSON and output each batch
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('/tmp/migration-batches.json'));
console.log('Total batches:', data.batchCount);

// Output each batch to a separate file
for (let i = 0; i < data.batches.length; i++) {
  fs.writeFileSync('/tmp/batch' + i + '.sql', data.batches[i]);
}
console.log('Generated ' + data.batchCount + ' batch files');
"

echo "Ready to run batches. Use the Supabase MCP tool to execute each batch."
echo "Or run with network access to use the REST API directly."





