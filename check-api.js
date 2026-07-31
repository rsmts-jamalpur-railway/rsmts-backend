const http = require('http');

http.get('http://localhost:3001/api/reports/movements-data?startDate=2026-07-31&endDate=2026-07-31', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      if (parsed.success) {
        let dispatchCount = 0;
        let readyCount = 0;
        parsed.data.forEach(log => {
          if (log.new_status === 'Dispatched') dispatchCount++;
          if (log.new_status === 'Ready_For_Outturn') readyCount++;
        });
        console.log(`Dispatched: ${dispatchCount}, Ready: ${readyCount}, Total: ${parsed.data.length}`);
      } else {
        console.log('API Error:', parsed);
      }
    } catch (e) {
      console.log('Parse error:', e.message);
    }
  });
}).on("error", (err) => {
  console.log("Error: " + err.message);
});
