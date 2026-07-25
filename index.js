// This file is needed for Vercel to recognize the project
// It redirects to the API endpoint

export default function handler(req, res) {
    res.status(200).json({
        message: 'OTP API is running!',
        endpoint: '/api/otp',
        usage: 'GET or POST with parameters: number and count',
        example: 'GET /api/otp?number=3376313363&count=3'
    });
}
