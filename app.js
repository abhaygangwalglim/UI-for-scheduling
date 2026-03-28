/**
 * AI Appointment Scheduler Logic
 * Handles conversational flow directly with an n8n AI Agent via Webhook.
 */

// --- CONFIGURATION ---
const N8N_WEBHOOK_URL = 'https://abhay-glim.app.n8n.cloud/webhook/chat';

// --- STATE MANAGEMENT ---
// Generate a unique session ID for the n8n Agent's Window Buffer Memory to remember the user.
// Uses crypto.randomUUID if available, else fallback to random string.
let sessionId = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).substring(2, 15);

// --- DOM ELEMENTS ---
const chatContent = document.getElementById('chat-content');
const chatWindow = document.getElementById('chat-window');
const typingIndicator = document.getElementById('typing-indicator');
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const resetBtn = document.getElementById('reset-btn');

// --- HELPER FUNCTIONS ---
const scrollToBottom = () => {
    chatWindow.scrollTop = chatWindow.scrollHeight;
};

const formatTime = () => {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// --- UI UPDATERS ---
const addMessage = (text, sender, isHTML = false) => {
    const messageGroup = document.createElement('div');
    messageGroup.className = `message-group ${sender}-message`;

    const time = formatTime();

    if (isHTML) {
        messageGroup.innerHTML = `
            <div class="message-bubble blur-effect">
                ${text}
            </div>
            <span class="message-time">${time}</span>
        `;
    } else {
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble blur-effect';

        // Ensure even array data or object falls back to string representation
        bubble.textContent = typeof text === 'string' ? text : JSON.stringify(text);

        const timeSpan = document.createElement('span');
        timeSpan.className = 'message-time';
        timeSpan.textContent = time;

        messageGroup.appendChild(bubble);
        messageGroup.appendChild(timeSpan);
    }

    chatContent.appendChild(messageGroup);
    scrollToBottom();
};

const showTyping = () => {
    typingIndicator.classList.remove('hidden');
    chatContent.appendChild(typingIndicator); // Move to bottom
    scrollToBottom();
};

const hideTyping = () => {
    typingIndicator.classList.add('hidden');
};

const disableInput = (disable = true) => {
    userInput.disabled = disable;
    sendBtn.disabled = disable;
    if (disable) {
        userInput.classList.add('hide');
        sendBtn.classList.add('hide');
    } else {
        userInput.classList.remove('hide');
        sendBtn.classList.remove('hide');
        userInput.focus();
    }
};

// --- CORE LOGIC ---
const handleUserInput = async (value) => {
    if (!value.trim()) return;

    // Display user message
    addMessage(value, 'user');

    // Prepare for backend logic
    disableInput(true);
    showTyping();
    userInput.value = '';

    try {
        // Send data directly to n8n AI Agent Webhook
        const response = await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Important: Webhook in n8n needs CORS enabled if running from browser!
            },
            body: JSON.stringify({
                chatInput: value,
                sessionId: sessionId
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP_${response.status}`);
        }

        const data = await response.json();

        // Agents in n8n typically return their response mapped to `output` or `text`.
        const agentResponse = data.output || data.text || data.response || (typeof data === 'string' ? data : JSON.stringify(data));

        hideTyping();
        addMessage(agentResponse, 'ai', false);

    } catch (error) {
        console.error("Webhook fetch failed:", error);
        hideTyping();

        let errorHint = `Ensure your n8n test webhook is active.`;
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            errorHint = `<strong>CORS Error:</strong> Your browser blocked the request. Open your n8n Webhook Node, go to Options, and check <strong>Enable CORS</strong> (or 'Add Response Headers' -> Access-Control-Allow-Origin: *).`;
        } else if (error.message.includes('HTTP_404')) {
            errorHint = `<strong>Webhook 404:</strong> The URL wasn't found. Because it's a 'webhook-test' URL, you must click <strong>"Listen for Test Event"</strong> in n8n before sending a message! Also ensure the Webhook expects a POST request.`;
        } else if (error.message.includes('HTTP_405')) {
            errorHint = `<strong>Method Not Allowed (405):</strong> The Webhook is configured for GET, but we sent a POST. Change the Webhook Method to POST in n8n.`;
        }

        const errorHTML = `
            <strong>Connection Error</strong><br>
            Unable to communicate with the n8n scheduling assistant.<br><br>
            <em style="font-size: 0.85rem; color: #ff6b6b">${errorHint}</em>
        `;
        addMessage(errorHTML, 'ai', true);
    } finally {
        disableInput(false);
    }
};

window.resetConversation = () => {
    // Re-initialize session so model memory is fresh
    sessionId = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(2, 15);

    // Clear chat UI
    Array.from(chatContent.children).forEach(child => {
        // Do not remove the typing indicator element from the DOM entirely
        if (child !== typingIndicator) {
            chatContent.removeChild(child);
        }
    });

    // Re-add initial initial-message
    addMessage("Hi there! I'm Nova, your AI scheduling assistant. I can help you book an appointment quickly. Let's get started. What can I help you with?", 'ai');
};

// --- EVENT LISTENERS ---
chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (userInput.disabled || !userInput.value.trim()) return;
    handleUserInput(userInput.value);
});

// Built-in explicit listener for Enter key inside input 
userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        if (userInput.disabled || !userInput.value.trim()) return;
        handleUserInput(userInput.value);
    }
});

resetBtn.addEventListener('click', () => {
    window.resetConversation();
});

// Initialization
window.onload = () => {
    userInput.focus();
};
