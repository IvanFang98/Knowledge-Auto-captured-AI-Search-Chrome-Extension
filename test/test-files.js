require('dotenv').config();
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function testFileHandling() {
  try {
    console.log('Testing file handling with OpenAI API...');
    
    // Create a test file
    console.log('\nCreating test file...');
    const testFile = path.join(__dirname, 'test.txt');
    const testContent = 'SmartGrab AI Search is a powerful Chrome extension that helps users quickly find and analyze information from web pages.';
    fs.writeFileSync(testFile, testContent);
    console.log('Test file created');
    
    // Upload file
    console.log('\nUploading file...');
    const file = await openai.files.create({
      file: fs.createReadStream(testFile),
      purpose: 'assistants'
    });
    console.log('File uploaded:', file.id);
    
    // Create assistant
    console.log('\nCreating assistant...');
    const assistant = await openai.beta.assistants.create({
      name: "Test Assistant",
      instructions: "You are a test assistant. Please analyze the content of the uploaded files.",
      model: "gpt-4-turbo-preview",
      tools: [{ type: "file_search" }]
    });
    console.log('Assistant created:', assistant.id);
    
    // Update assistant with file
    console.log('\nAttaching file to assistant...');
    await openai.beta.assistants.update(
      assistant.id,
      {
        file_ids: [file.id]
      }
    );
    console.log('File attached to assistant');
    
    // Create thread
    console.log('\nCreating thread...');
    const thread = await openai.beta.threads.create();
    console.log('Thread created:', thread.id);
    
    // Add message
    console.log('\nAdding message...');
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: "What is SmartGrab AI Search? Please search through the uploaded files to find this information.",
      metadata: {
        file_ids: [file.id]
      }
    });
    console.log('Message added');
    
    // Run assistant
    console.log('\nStarting run...');
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistant.id,
      instructions: "Please use the file_search tool to find information about SmartGrab AI Search in the uploaded files."
    });
    console.log('Run started:', run.id);
    
    // Poll for completion
    console.log('\nWaiting for run to complete...');
    let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    while (runStatus.status === 'in_progress' || runStatus.status === 'queued') {
      console.log('Status:', runStatus.status);
      await new Promise(resolve => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    }
    console.log('Run completed with status:', runStatus.status);
    
    // Get messages
    console.log('\nRetrieving messages...');
    const messages = await openai.beta.threads.messages.list(thread.id);
    const response = messages.data.find(msg => msg.role === 'assistant');
    if (response) {
      console.log('\nAssistant response:', response.content[0].text.value);
    } else {
      console.log('No response from assistant');
    }
    
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

testFileHandling(); 