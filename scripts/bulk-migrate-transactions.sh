#!/bin/bash
# Bulk migrate transactions from SQLite to Supabase in batches

DB_PATH="/Volumes/LaCie/WEBDEV/agentflow/data/agentflow.db"
BATCH_SIZE=50
TOTAL=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM financial_transactions")
BATCHES=$((($TOTAL + $BATCH_SIZE - 1) / $BATCH_SIZE))

echo "Total transactions: $TOTAL"
echo "Batch size: $BATCH_SIZE"
echo "Total batches: $BATCHES"
echo ""

for ((i=0; i<$BATCHES; i++)); do
    OFFSET=$(($i * $BATCH_SIZE))
    echo "Processing batch $((i+1))/$BATCHES (offset: $OFFSET)..."
    
    # Generate VALUES for this batch
    VALUES=$(sqlite3 "$DB_PATH" "
SELECT '(''1662c902-1b18-41ec-be1f-e145f4054aba'', ''' || transaction_id || ''', ''' || account_id || ''', ''' || transaction_id || ''', ''' || REPLACE(description, '''', '''''') || ''', ' || COALESCE('''' || REPLACE(merchant, '''', '''''') || '''', 'NULL') || ', ' || amount || ', ''USD'', ' || COALESCE('''' || category || '''', 'NULL') || ', ''' || date || ''', false, ''teller'')' 
FROM financial_transactions
LIMIT $BATCH_SIZE OFFSET $OFFSET" | tr '\n' ',' | sed 's/,$//')
    
    # Output to file for this batch
    echo "INSERT INTO transactions (user_id, transaction_id, teller_account_id, teller_transaction_id, name, merchant_name, amount, iso_currency_code, category, date, pending, source) VALUES 
$VALUES
ON CONFLICT (transaction_id) DO UPDATE SET 
  name = EXCLUDED.name,
  merchant_name = EXCLUDED.merchant_name,
  amount = EXCLUDED.amount,
  category = EXCLUDED.category,
  teller_account_id = EXCLUDED.teller_account_id;" > "/tmp/batch_${i}.sql"
    
done

echo ""
echo "Generated $BATCHES batch files in /tmp/"
echo "Files: /tmp/batch_0.sql through /tmp/batch_$((BATCHES-1)).sql"

