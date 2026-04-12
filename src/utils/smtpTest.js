/**
 * SMTP Connectivity Test Utility
 * 
 * Tests connection to Gmail SMTP to diagnose if Render is blocking SMTP ports.
 * This is a temporary debugging utility and can be safely removed later.
 * 
 * Tests:
 * - Port 587 (STARTTLS)
 * - Port 465 (SSL/TLS)
 */

const net = require('net');

const SMTP_HOST = 'smtp.gmail.com';
const PORTS_TO_TEST = [587, 465];
const TIMEOUT_MS = 5000; // 5 seconds

/**
 * Test connection to a specific SMTP port
 * @param {string} host - SMTP host
 * @param {number} port - Port to test
 * @returns {Promise<{port: number, status: string, message: string}>}
 */
function testSmtpPort(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let timedOut = false;

    // Set timeout
    const timeout = setTimeout(() => {
      timedOut = true;
      socket.destroy();
      resolve({
        port,
        status: 'TIMEOUT',
        message: `Connection timeout on port ${port} (Render may be blocking this port)`
      });
    }, TIMEOUT_MS);

    // Handle successful connection
    socket.on('connect', () => {
      socket.destroy();
      clearTimeout(timeout);
      resolve({
        port,
        status: 'SUCCESS',
        message: `✅ Connected to ${host}:${port}`
      });
    });

    // Handle connection error
    socket.on('error', (error) => {
      clearTimeout(timeout);
      if (!timedOut) {
        resolve({
          port,
          status: 'ERROR',
          message: `Error on port ${port}: ${error.code || error.message}`
        });
      }
    });

    // Initiate connection
    socket.connect(port, host);
  });
}

/**
 * Run SMTP connectivity tests
 * Logs results to console but doesn't crash if connections fail
 */
async function runSmtpTest() {
  console.log('\n📧 === SMTP CONNECTIVITY TEST (DEBUG) ===');
  console.log(`🔍 Testing ${SMTP_HOST} on ports: ${PORTS_TO_TEST.join(', ')}`);
  console.log(`⏱️  Timeout: ${TIMEOUT_MS}ms per port\n`);

  try {
    // Test all ports in parallel
    const testPromises = PORTS_TO_TEST.map(port => testSmtpPort(SMTP_HOST, port));
    const results = await Promise.all(testPromises);

    // Log results
    let anySuccess = false;
    results.forEach((result) => {
      const statusIcon = result.status === 'SUCCESS' ? '✅' : '❌';
      console.log(`${statusIcon} Port ${result.port}: ${result.message}`);
      if (result.status === 'SUCCESS') {
        anySuccess = true;
      }
    });

    // Summary
    console.log('\n📊 SMTP Test Summary:');
    if (anySuccess) {
      console.log('✅ At least one SMTP port is reachable');
      console.log('   → Render is NOT blocking SMTP connections');
      console.log('   → Check email configuration (credentials, from address, etc.)');
    } else {
      console.log('❌ No SMTP ports are reachable');
      console.log('   → Render may be blocking SMTP connections');
      console.log('   → Consider switching to API-based email service (e.g., Resend)');
    }
    console.log('======================================\n');

    return results;
  } catch (error) {
    console.error('❌ SMTP Test Error:', error.message);
    console.log('======================================\n');
    return [];
  }
}

module.exports = { runSmtpTest };
