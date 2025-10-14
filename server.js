// server.js - Deploy this to Railway, Render, or your preferred platform
const uWS = require('uWebSockets.js');
const port = process.env.PORT || 9001;

// Store active connections
const connections = new Map();

uWS.App()
  .ws('/*', {
    compression: uWS.SHARED_COMPRESSOR,
    maxPayloadLength: 16 * 1024 * 1024,
    idleTimeout: 120,
    
    open: (ws) => {
      const id = Math.random().toString(36).substr(2, 9);
      ws.id = id;
      connections.set(id, { ws, confluences: [], lastPing: Date.now() });
      console.log(`[${id}] Client connected. Total: ${connections.size}`);
      ws.send(JSON.stringify({ type: 'connected', sessionId: id, timestamp: Date.now() }));
    },
    
    message: (ws, message, isBinary) => {
      const startTime = Date.now();
      try {
        const data = JSON.parse(Buffer.from(message).toString());
        const session = connections.get(ws.id);
        
        console.log(`[${ws.id}] Received: ${data.type}`);
        
        switch (data.type) {
          case 'ping':
            session.lastPing = Date.now();
            ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            break;
            
          case 'init':
            session.userId = data.userId;
            session.confluences = data.confluences || [];
            console.log(`[${ws.id}] Initialized with ${session.confluences.length} rules`);
            ws.send(JSON.stringify({ type: 'init_ack', timestamp: Date.now() }));
            break;
            
          case 'chart_update':
            const processingStart = Date.now();
            // Process chart update (analyze against confluences)
            const result = analyzeChart(data, session.confluences);
            const processingTime = Date.now() - processingStart;
            
            ws.send(JSON.stringify({
              type: 'analysis_result',
              ...result,
              latency: {
                received: startTime,
                processed: Date.now(),
                processingTime
              }
            }));
            console.log(`[${ws.id}] Analysis completed in ${processingTime}ms`);
            break;
            
          case 'update_confluences':
            session.confluences = data.confluences || [];
            console.log(`[${ws.id}] Updated to ${session.confluences.length} rules`);
            break;
        }
      } catch (error) {
        console.error(`[${ws.id}] Error:`, error.message);
        ws.send(JSON.stringify({ type: 'error', message: error.message }));
      }
    },
    
    close: (ws, code, message) => {
      console.log(`[${ws.id}] Disconnected`);
      connections.delete(ws.id);
    }
  })
  .listen(port, (token) => {
    if (token) {
      console.log(`🚀 WebSocket server running on port ${port}`);
    } else {
      console.log(`❌ Failed to listen on port ${port}`);
    }
  });

// Heartbeat check every 30s
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of connections.entries()) {
    if (now - session.lastPing > 60000) {
      console.log(`[${id}] Timeout, closing`);
      session.ws.close();
      connections.delete(id);
    }
  }
}, 30000);

function analyzeChart(update, confluences) {
  // Placeholder analysis - integrate your actual logic here
  const allMet = confluences.length > 0;
  
  return {
    alert: allMet,
    severity: allMet ? 'high' : 'info',
    message: allMet ? 'All criteria met' : 'Monitoring...',
    rulesStatus: confluences.map(rule => ({
      ruleName: rule.name,
      met: true,
      confidence: 0.85
    })),
    detectedElements: {
      trend: 'uptrend',
      positionDetected: false
    }
  };
}
