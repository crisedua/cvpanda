import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const DebugInfo = () => {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function checkTables() {
      try {
        setLoading(true);
        
        // List all tables in the public schema
        const { data, error } = await supabase
          .rpc('list_tables');
          
        if (error) {
          throw error;
        }
        
        setTables(data || []);
      } catch (err) {
        console.error('Error checking tables:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    checkTables();
  }, []);

  return (
    <div style={{ margin: '20px', padding: '20px', border: '1px solid #ccc', borderRadius: '5px' }}>
      <h2>Supabase Database Debug Info</h2>
      
      {loading ? (
        <p>Loading database information...</p>
      ) : error ? (
        <div style={{ color: 'red' }}>
          <p>Error: {error}</p>
          <p>Try using this SQL function in Supabase SQL Editor:</p>
          <pre>
            {`CREATE OR REPLACE FUNCTION list_tables()
RETURNS SETOF information_schema.tables
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM information_schema.tables 
  WHERE table_schema = 'public';
$$;`}
          </pre>
        </div>
      ) : (
        <div>
          <h3>Tables in Public Schema:</h3>
          {tables.length === 0 ? (
            <p>No tables found or function not available</p>
          ) : (
            <ul>
              {tables.map((table, index) => (
                <li key={index}>{table.table_name}</li>
              ))}
            </ul>
          )}
          
          <h3>Manual Check for saved_jobs Table:</h3>
          <button
            onClick={async () => {
              try {
                // Try to query saved_jobs table
                const { data, error } = await supabase
                  .from('saved_jobs')
                  .select('count')
                  .limit(1);
                  
                if (error) {
                  if (error.code === '42P01') {
                    alert('The saved_jobs table does NOT exist in the database!');
                  } else {
                    alert(`Error checking saved_jobs table: ${error.message}`);
                  }
                } else {
                  alert('The saved_jobs table EXISTS in the database!');
                }
              } catch (err) {
                alert(`Exception: ${err.message}`);
              }
            }}
            style={{ 
              padding: '8px 16px', 
              backgroundColor: '#4CAF50', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Check saved_jobs Table
          </button>
        </div>
      )}
    </div>
  );
};

export default DebugInfo; 