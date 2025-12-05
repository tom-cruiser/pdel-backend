const fetch = require('node-fetch');

async function testEmailConfirmation() {
  console.log('Testing email confirmation flow...\n');
  
  try {
    // 1. Register a new user
    console.log('1. Registering test user...');
    const registerRes = await fetch('http://localhost:3001/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test-confirm@example.com',
        password: 'password123',
        full_name: 'Test User'
      })
    });
    
    const registerData = await registerRes.json();
    console.log('Register response:', JSON.stringify(registerData, null, 2));
    
    if (!registerData.success) {
      console.log('Registration failed, continuing test with manual token...');
    }
    
    // 2. Manually get a token from MongoDB (you need to run this after registration)
    console.log('\n2. To test confirmation:');
    console.log('   - Check your MongoDB for the email_confirm_token');
    console.log('   - Run: db.profiles.findOne({email: "test-confirm@example.com"})');
    console.log('   - Then use that token to test the confirmation endpoint');
    
    // 3. Test health endpoint
    console.log('\n3. Testing health endpoint...');
    const healthRes = await fetch('http://localhost:3001/api/auth/health');
    const healthData = await healthRes.json();
    console.log('Health:', healthData.success ? '✅' : '❌');
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testEmailConfirmation();
