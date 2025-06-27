require('dotenv').config();
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function testOpenAI() {
  try {
    console.log('Testing OpenAI API connection...');
    
    // Test file upload
    console.log('\nTesting file upload...');
    const testFile = path.join(__dirname, 'test.txt');
    fs.writeFileSync(testFile, 'This is a test document.');
    
    const file = await openai.files.create({
      file: fs.createReadStream(testFile),
      purpose: 'assistants'
    });
    console.log('File uploaded successfully:', file.id);
    
    // Test assistant creation
    console.log('\nTesting assistant creation...');
    const assistant = await openai.beta.assistants.create({
      name: "Test Assistant",
      instructions: "You are a test assistant.",
      model: "gpt-4-turbo-preview",
      tools: [{ type: "file_search" }]
    });
    console.log('Assistant created successfully:', assistant.id);

    // Attach file to assistant
    console.log('\nAttaching file to assistant...');
    const updatedAssistant = await openai.beta.assistants.update(
      assistant.id,
      {
        file_ids: [file.id]
      }
    );
    console.log('File attached successfully');
    
    // Test thread creation
    console.log('\nTesting thread creation...');
    const thread = await openai.beta.threads.create();
    console.log('Thread created successfully:', thread.id);
    
    // Test message creation
    console.log('\nTesting message creation...');
    const message = await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: "What's in the test document?"
    });
    console.log('Message created successfully:', message.id);
    
    // Test run creation
    console.log('\nTesting run creation...');
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistant.id
    });
    console.log('Run created successfully:', run.id);
    
    // Clean up
    console.log('\nCleaning up...');
    await openai.beta.assistants.del(assistant.id);
    await openai.files.del(file.id);
    fs.unlinkSync(testFile);
    console.log('Cleanup completed');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testOpenAI(); 