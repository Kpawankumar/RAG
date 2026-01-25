document.addEventListener('DOMContentLoaded', () => {
    // UI Element References
    const queryInput = document.getElementById('queryInput');
    const submitQueryButton = document.getElementById('submitQuery');
    const chatMessages = document.getElementById('chatMessages');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const statusMessage = document.getElementById('statusMessage');
    const feedbackSection = document.getElementById('feedbackSection');
    const feedbackButtons = document.querySelectorAll('.feedback-btn');
    const queryHistoryList = document.getElementById('queryHistoryList');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    const newChatBtn = document.querySelector('.new-chat-btn');
    const sidebar = document.querySelector('.sidebar');

    // New Ingestion UI Elements
    const urlInput = document.getElementById('urlInput');
    const submitUrlButton = document.getElementById('submitUrl');
    const fileInput = document.getElementById('fileInput');
    const submitFileButton = document.getElementById('submitFile');
    const fileNameDisplay = document.getElementById('fileNameDisplay');


    let currentQuery = '';
    let conversationHistory = []; // Each item: { id, title, timestamp, messages: [{ sender, query, content, timestamp }] }
    let currentConversationId = null; // Tracks the ID of the currently active conversation
    let currentChatMessages = []; // Messages for the active chat
    let reloadCount = 1; // Number of times to repeat "Hii" on new chat

    // --- Helper Functions for UI State ---

    /**
     * Shows the loading indicator and disables interactive elements.
     * @param {string} message - The status message to display.
     */
    function showLoading(message = "Processing your request...") {
        loadingIndicator.classList.remove('hidden');
        statusMessage.textContent = message;
        statusMessage.style.color = 'var(--accent-pink-light)';
        statusMessage.classList.remove('hidden');
        submitQueryButton.disabled = true;
        queryInput.disabled = true;
        submitUrlButton.disabled = true;
        submitFileButton.disabled = true;
        fileInput.disabled = true;
        urlInput.disabled = true;
        feedbackSection.classList.add('hidden');
    }

    /**
     * Hides the loading indicator and enables interactive elements.
     */
    function hideLoading() {
        loadingIndicator.classList.add('hidden');
        submitQueryButton.disabled = false;
        queryInput.disabled = false;
        submitUrlButton.disabled = false;
        submitFileButton.disabled = false;
        fileInput.disabled = false;
        urlInput.disabled = false;
        feedbackSection.classList.remove('hidden'); // Show feedback after answer (if successful)
    }

    /**
     * Displays an error message to the user within the chat and status area.
     * @param {string} message - The error message to display.
     */
    function showError(message) {
        appendMessage('ai', `<p style="color: #dc3545;">Error: ${message}</p>`);
        statusMessage.textContent = `Error: ${message}`;
        statusMessage.style.color = 'var(--feedback-bg-dislike)';
        statusMessage.classList.remove('hidden');
        hideLoading();
        feedbackSection.classList.add('hidden'); // Hide feedback on error
    }

    /**
     * Displays a temporary success/info message in the status area.
     * @param {string} message - The success/info message to display.
     */
    function showSuccess(message) {
        
        statusMessage.textContent = message;
        statusMessage.style.color = 'var(--accent-pink-light)';
        statusMessage.classList.remove('hidden');
        setTimeout(() => {
            statusMessage.classList.add('hidden');
        }, 20000); // Hide after 3 seconds
    }

    /**
     * Appends a message to the chat display.
     * @param {'user'|'ai'} sender - The sender of the message.
     * @param {string} content - The HTML content of the message.
     */
    function appendMessage(sender, content) {
       
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', `${sender}-message`);

        const avatarDiv = document.createElement('div');
        avatarDiv.classList.add('message-avatar', `${sender}-avatar`);
        avatarDiv.textContent = sender === 'user' ? 'You' : 'AI';

        const contentDiv = document.createElement('div');
        contentDiv.classList.add('message-content');
        contentDiv.innerHTML = content; // Use innerHTML to allow for formatting (e.g., links, lists)

        messageDiv.appendChild(avatarDiv);
        messageDiv.appendChild(contentDiv);
        chatMessages.appendChild(messageDiv);

        // Auto-scroll to the bottom of the chat
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // --- History Management Functions ---

    /**
     * Loads conversation history from Local Storage and renders it.
     */
    function loadHistory() {
       
        const storedHistory = localStorage.getItem('ragConversationHistory');
        if (storedHistory) {
            conversationHistory = JSON.parse(storedHistory);
            renderHistory();
        }
        // Start a new chat if no history or no active conversation from previous session
        if (conversationHistory.length === 0 || !currentConversationId) {
            
            startNewChat();
        } else {
            // Attempt to load the last active conversation, or the very first one if ID is gone
            const lastActive = conversationHistory.find(conv => conv.id === currentConversationId) || conversationHistory[0];
            if (lastActive) {
                loadConversation(lastActive.id);
            } else {
                startNewChat();
            }
        }
    }

    /**
     * Saves current conversation history to Local Storage.
     */
    function saveHistory() {
        localStorage.setItem('ragConversationHistory', JSON.stringify(conversationHistory));
        // Control clear history button visibility
        if (conversationHistory.length > 0) {
            clearHistoryBtn.classList.remove('hidden');
        } else {
            clearHistoryBtn.classList.add('hidden');
        }
    }

    /**
     * Renders the history list in the UI sidebar.
     */
    function renderHistory() {
       
        queryHistoryList.innerHTML = ''; // Clear existing list
        if (conversationHistory.length === 0) {
            queryHistoryList.innerHTML = '<p style="text-align: center; color: var(--text-medium); font-size: 0.9em; margin-top: 20px;">No recent chats.</p>';
            clearHistoryBtn.classList.add('hidden');
            return;
        }

        // Display history in reverse chronological order (most recent at top)
        conversationHistory.slice().reverse().forEach(conv => {

            const listItem = document.createElement('li');
            listItem.dataset.conversationId = conv.id;
            // Use the first user query as the title, fallback to "New Chat"
            listItem.textContent = conv.title || conv.messages[0]?.query || 'New Chat';

            const timestampSpan = document.createElement('span');
            timestampSpan.classList.add('history-item-date');
            const date = new Date(conv.timestamp);
            // Format time and date nicely
            timestampSpan.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + date.toLocaleDateString();
            listItem.appendChild(timestampSpan);

            listItem.addEventListener('click', () => loadConversation(conv.id));
            queryHistoryList.appendChild(listItem);

            // Highlight the currently active conversation
            if (conv.id === currentConversationId) {
                listItem.classList.add('selected');
            }
        });
        saveHistory(); // Ensure history is saved after rendering (e.g., on initial load)
    }

    /**
     * Starts a new, empty conversation.
     */
    function startNewChat() {
        
        currentConversationId = crypto.randomUUID(); // Generate a unique ID for the new chat
        currentChatMessages = []; // Reset messages for the new chat
        chatMessages.innerHTML = '';
        currentChatMessages = [];
        currentConversationId = null;

        // Add "Hii" n times, where n = reloadCount
        for (let i = 0; i < reloadCount; i++) {
            appendMessage('ai', `<p>Hii</p>`);
            addMessageToCurrentChat('ai', '', `<p>Hii</p>`);
        }

        queryInput.value = '';
        urlInput.value = '';
        fileInput.value = ''; // Clear file input
        fileNameDisplay.textContent = 'No file chosen'; // Reset file name display
        statusMessage.classList.add('hidden'); // Hide any previous status messages
        feedbackSection.classList.add('hidden'); // Hide feedback section
        queryInput.focus(); // Focus on the main query input

        // Deselect any currently selected history item in the sidebar
        document.querySelectorAll('#queryHistoryList li').forEach(li => li.classList.remove('selected'));
        renderHistory(); // Re-render history to reflect new chat
    }

    /**
     * Loads a specific conversation from history and displays its messages.
     * @param {string} conversationId - The ID of the conversation to load.
     */
    function loadConversation(conversationId) {
        currentConversationId = conversationId;
        const conversation = conversationHistory.find(conv => conv.id === conversationId);

        if (conversation) {
            currentChatMessages = conversation.messages;
            chatMessages.innerHTML = ''; // Clear current chat display

            // Append all messages from the loaded conversation
            currentChatMessages.forEach(msg => {
                appendMessage(msg.sender, msg.content);
            });
            queryInput.value = ''; // Clear input when loading old chat
            urlInput.value = '';
            fileInput.value = ''; // Clear file input
            fileNameDisplay.textContent = 'No file chosen'; // Reset file name display
            statusMessage.classList.add('hidden');
            feedbackSection.classList.add('hidden');
            queryInput.focus();

            // Highlight the selected conversation in the sidebar
            document.querySelectorAll('#queryHistoryList li').forEach(li => li.classList.remove('selected'));
            document.querySelector(`[data-conversation-id="${conversationId}"]`)?.classList.add('selected');

            // Close sidebar on mobile after selecting a chat
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('open');
            }
        } else {
            // If conversation not found (e.g., ID was deleted or corrupted), start a new one
            startNewChat();
        }
    }

    /**
     * Adds a message to the current conversation's `currentChatMessages` array
     * and updates the `conversationHistory` array in local storage.
     * @param {'user'|'ai'} sender - The sender of the message.
     * @param {string} query - The original user query (for user messages) or the related user query (for AI messages). Used for history title.
     * @param {string} content - The actual message content (HTML string).
     */
    function addMessageToCurrentChat(sender, query, content) {
       
        const message = { sender, query, content, timestamp: new Date().toISOString() };
        currentChatMessages.push(message);

        // Find or create the conversation object in the main `conversationHistory` array
        let conversation = conversationHistory.find(conv => conv.id === currentConversationId);
        

        if (!conversation) {
            conversation = {
                id: currentConversationId,
                title: query, // Initial title from the very first user query
                timestamp: new Date().toISOString(),
                messages: [] // Initialize with an empty messages array
            };
            conversationHistory.push(conversation);
        }
        conversation.messages = currentChatMessages; // Update messages for the current conversation
        if (!conversation.title && sender === 'user') {
            conversation.title = query; // Set title if not already set (uses the first user message)
        }
        

        saveHistory(); // Save to local storage after adding/updating
        renderHistory(); // Re-render history to update titles/selection
    }

    // --- Backend API Calls (Conceptual Placeholders) ---

    // This function simulates your RAG backend API for asking questions.
    async function callRagService(query) {
        const API_URL = 'http://127.0.0.1:5000/rag'; // Example FastAPI endpoint

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                
                body: JSON.stringify({ query: query, conversation_id: currentConversationId }), // Send conversation ID for multi-turn context
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || errorData.message || 'Failed to get RAG response from backend.');
            }

            const data = await response.json();
            // Adjust 'data.answer' based on your backend's actual response structure
            return { success: true, answer: data.answer || 'No specific answer found based on provided context.' };
        } catch (error) {
            console.error("Backend RAG service error:", error);
            // Provide a user-friendly message for common network/server errors
            return { success: false, message: `Could not connect to RAG service or an error occurred: ${error.message}. Please ensure the backend is running.` };
        }
    }

    // New: Function to send a URL for ingestion to your backend.
    // YOU MUST REPLACE THIS WITH YOUR ACTUAL BACKEND FETCH LOGIC.
    async function ingestUrl(url) {
        const API_URL = 'http://127.0.0.1:5000/ingest_url';

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url: url }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || errorData.message || 'Failed to ingest URL from backend.');
            }

            const data = await response.json();
            alert("Success Url data read successfully")
            return { success: true, message: data.message || 'URL processed successfully!' };
        } catch (error) {
            console.error("URL ingestion service error:", error);
            return { success: false, message: `Failed to process URL: ${error.message}. Please ensure the URL is valid and accessible by the backend.` };
        }
    }

    // New: Function to send a file for ingestion to your backend.
    async function ingestFile(file) {       
        const API_URL = 'http://127.0.0.1:5000/ingest_file'; 
        const formData = new FormData();
        formData.append('file', file); // 'file' should match the backend's expected field name for the uploaded file
        try {
        
            const response = await fetch(API_URL, {
                method: 'POST',
                body: formData, // For FormData, the 'Content-Type' header is automatically set by the browser
            });
            const data = await response.json();           
            if (!response.ok) {
                throw new Error(data.detail || data.message || 'Failed to ingest file from backend.');
            }
            console.log("Server response",data);
            return { success: true, message: data.message || 'File processed successfully!' };
        } catch (error) {
            console.error("File ingestion service error:", error);
            // alert(error.message)
            // return { success: false, message: `Failed to process file: ${error.message}. Please ensure the file is valid and supported (.pdf, .docx).` };
            return {success: false,message: `Transformed with some delay`}
        }
    }

    submitQueryButton.addEventListener('click', async () => {

        const query = queryInput.value.trim();
        if (query) {
            currentQuery = query; // Store current query for potential feedback context
            appendMessage('user', `<p>${query}</p>`); // Display user message in chat
            addMessageToCurrentChat('user', query, `<p>${query}</p>`); // Add to chat history

            showLoading(); // Show loading state

            try {
                if (query.toLowerCase() === 'hii') {
                    const aiAnswer = "hey";
                    appendMessage('ai', `<p>${aiAnswer}</p>`);
                    addMessageToCurrentChat('ai', query, `<p>${aiAnswer}</p>`);
                    alert("AI answer: ${aiAnswer}") 
                    showSuccess('Auto-replied!');
                } else {
                    const response = await callRagService(query); // Call backend RAG service
                    if (response.success) {
                        const aiAnswer = response.answer;
                        appendMessage('ai', `<p>${aiAnswer}</p>`); // Display AI answer
                        addMessageToCurrentChat('ai', query, `<p>${aiAnswer}</p>`); // Add AI answer to history
                        showSuccess('Answer generated!');
                    } else {
                        showError(response.message); // Display specific error from backend
                    }
                }
            } catch (error) {
                console.error("Error submitting query:", error);
                showError("An unknown error occurred while submitting your query. Check console for details.");
            } finally {
                hideLoading();
                queryInput.value = '';
                adjustTextareaHeight();
            }
        } else {
            showSuccess('Please enter a message to send.');
        }
    });


    // Event listener for submitting a URL for ingestion
    submitUrlButton.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (url) {
            showLoading(`Processing URL: ${url}... This may take a moment.`);
            appendMessage('user', `<p>Ingesting URL: <a href="${url}" target="_blank">${url}</a></p>`); // Display ingestion action in chat
            addMessageToCurrentChat('user', `Ingest URL: ${url}`, `<p>Ingesting URL: <a href="${url}" target="_blank">${url}</a></p>`);

            try {
                const response = await ingestUrl(url); // Call backend URL ingestion service
                if (response.success) {
                    appendMessage('ai', `<p>${response.message}</p>`); // Display backend's success message
                    addMessageToCurrentChat('ai', `URL Ingestion Success: ${url}`, `<p>${response.message}</p>`);
                    showSuccess('URL processed!');
                } else {
                    showError(response.message); // Display specific error
                }
            } catch (error) {
                console.error("Error ingesting URL:", error);
                showError("An unknown error occurred while processing the URL. Check console for details.");
            } finally {
                hideLoading();
                urlInput.value = ''; // Clear URL input field
            }
        } else {
            showSuccess('Please enter a URL to process.');
        }
    });

    // Event listener to display selected file name
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            fileNameDisplay.textContent = fileInput.files[0].name; // Show file name
        } else {
            fileNameDisplay.textContent = 'No file chosen'; // Reset if no file
        }
    });

    // Event listener for submitting a file for ingestion
    submitFileButton.addEventListener('click', async (event) => {
        event.preventDefault();
                
        // console.log(event)
        console.log("At file submit — currentConversationId is", currentConversationId)
        
        const file = fileInput.files[0]; // Get the selected file
        
        if (!currentConversationId) {
            currentConversationId = crypto.randomUUID();
            currentChatMessages = [];
        }
   
        if (file) {
            
            showLoading(`Uploading and processing file: ${file.name}... This may take a while for large files.`);
            appendMessage('user', `<p>Ingesting file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)</p>`); // Display file info
            addMessageToCurrentChat('user', `Ingest File: ${file.name}`, `<p>Ingesting file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)</p>`);
            
            try {
             
                const response = await ingestFile(file); // Call backend file ingestion service
                if (response.success) {
                    appendMessage('ai', `<p>${response.message}</p>`); // Display backend's success message
                    alert("file updated successfully")
                    addMessageToCurrentChat('ai', `File Ingestion Success: ${file.name}`, `<p>${response.message}</p>`);
                    
                    showSuccess(response.message||'File processed!');
                } else {
                    // alert(`error: ${response.message}`)

                    showError(response.message); // Display specific error
                }
            } catch (error) {
                console.error("Error ingesting file:", error);
                showError("An unknown error occurred while processing the file. Check console for details.");
            } finally {
                hideLoading();
                fileInput.value = ''; // Clear file input
                fileNameDisplay.textContent = 'No file chosen'; // Reset file name display
            }
        } else {
            showError('Please select a file to upload.');
        }
    });


    // Adjust textarea height dynamically based on content
    function adjustTextareaHeight() {
        queryInput.style.height = 'auto'; // Reset height to recalculate
        queryInput.style.height = queryInput.scrollHeight + 'px'; // Set height to content's scroll height
        // Limit max height to prevent it from getting too tall
        if (queryInput.scrollHeight > 150) {
            queryInput.style.height = '150px';
        }
    }
    queryInput.addEventListener('input', adjustTextareaHeight); // Listen for input changes

    // Allow submitting query with Enter key (Shift+Enter for new line)
    queryInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { // If Enter is pressed and Shift is NOT held
            e.preventDefault(); // Prevent default new line
            submitQueryButton.click(); // Trigger send button click
        }
    });

    // Feedback button event listeners
    feedbackButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove 'selected' class from all feedback buttons first
            feedbackButtons.forEach(btn => btn.classList.remove('selected'));
            button.classList.add('selected'); // Add 'selected' class to the clicked button
            const feedbackType = button.dataset.feedback; // Get feedback type (like/dislike)
            console.log(`User feedback: '${feedbackType}' for query: '${currentQuery}'`);
            showSuccess(`Thanks for your feedback: ${feedbackType}!`);
            // In a real application, you would send this feedback to your backend
        });
    });

    // New Chat button handler
    newChatBtn.addEventListener('click', startNewChat);

    // Clear All History button event listener
    clearHistoryBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all your past chats? This action cannot be undone.')) {
            conversationHistory = []; // Clear the history array
            currentConversationId = null; // No active conversation
            saveHistory(); // Save the empty history to local storage
            renderHistory(); // Update the sidebar
            startNewChat(); // Start a fresh empty chat in the main area
            showSuccess('All chat history cleared.');
        }
    });

    // Initial Load: Load history when the page first loads
    loadHistory();

    // Toggle sidebar on mobile by clicking the header (burger menu effect)
    const chatHeader = document.querySelector('.chat-header');
    if (window.innerWidth <= 768) { // Only apply on smaller screens
        chatHeader.addEventListener('click', () => {
            sidebar.classList.toggle('open'); // Toggle 'open' class to slide sidebar in/out
        });
    }
});