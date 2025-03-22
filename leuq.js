// chatbot-loader.js
(function() {
  // Prevent multiple loads
  if (window.MyChatbotLoaded) return;
  window.MyChatbotLoaded = true;

  // Create a unique ID for this chatbot instance
  const clientId = 'chtbt_' + Math.random().toString(36).substring(2, 9);

  // Load CSS
  function loadStyles() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/vue-material-design-icons/dist/vue-material-design-icons.css';
    document.head.appendChild(link);

    // Add required styles
    const style = document.createElement('style');
    style.textContent = `
      .my-gpt-chatbot-container {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 9999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      }
      .my-gpt-chat-button {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: transform 0.3s ease;
      }
      .my-gpt-chat-button:hover {
        transform: scale(1.1);
      }
      .my-gpt-chat-icon {
        font-size: 24px;
        color: white;
      }
      .my-gpt-chatbot-frame {
        position: fixed;
        bottom: 80px;
        right: 20px;
        width: 380px;
        height: 550px;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 5px 20px rgba(0, 0, 0, 0.2);
        display: none;
        background: white;
        border: 1px solid rgba(0, 0, 0, 0.1);
      }
      @media (max-width: 480px) {
        .my-gpt-chatbot-frame {
          width: 100%;
          height: 100%;
          right: 0;
          bottom: 0;
          border-radius: 0;
        }
      }
      .my-gpt-loading {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: white;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
      }
      .my-gpt-spinner {
        width: 24px;
        height: 24px;
        border: 2px solid rgba(0, 0, 0, 0.1);
        border-top-color: #3B82F6;
        border-radius: 50%;
        animation: my-gpt-spin 1s linear infinite;
      }
      @keyframes my-gpt-spin {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }

  // Load dependencies
  function loadDependencies(callback) {
    const scripts = [
      'https://cdn.jsdelivr.net/npm/vue@3/dist/vue.global.prod.js',
      'https://cdn.jsdelivr.net/npm/marked/marked.min.js'
    ];
    
    let loaded = 0;
    scripts.forEach(src => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => {
        loaded++;
        if (loaded === scripts.length) {
          callback();
        }
      };
      document.body.appendChild(script);
    });
  }

  // Create SSE class (from your sse.js)
  class SSE {
    constructor(url, options) {
      this.url = url;
      this.options = options || {};
      this.eventSource = null;
      this.listeners = {};
    }

    stream() {
      const xhr = new XMLHttpRequest();
      xhr.open(this.options.method || 'GET', this.url);
      
      const headers = this.options.headers || {};
      Object.keys(headers).forEach(key => {
        xhr.setRequestHeader(key, headers[key]);
      });
      
      xhr.onreadystatechange = () => {
        if (xhr.readyState === XMLHttpRequest.OPENED) {
          xhr.send(this.options.payload || null);
        } else if (xhr.readyState > XMLHttpRequest.OPENED) {
          this._processEvents(xhr);
        }
      };
      
      this.xhr = xhr;
    }

    _processEvents(xhr) {
      const text = xhr.responseText;
      const parts = text.split('\n\n');
      
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i].trim();
        if (!part) continue;
        
        const lines = part.split('\n');
        let eventType = 'message';
        let data = '';
        
        for (let j = 0; j < lines.length; j++) {
          const line = lines[j];
          if (line.startsWith('event:')) {
            eventType = line.substring(6).trim();
          } else if (line.startsWith('data:')) {
            data = line.substring(5).trim();
          }
        }
        
        if (data) {
          this._dispatchEvent(eventType, data);
        }
      }
    }

    _dispatchEvent(type, data) {
      const listeners = this.listeners[type] || [];
      const event = { type, data };
      
      listeners.forEach(callback => {
        callback(event);
      });
    }

    addEventListener(type, callback) {
      if (!this.listeners[type]) {
        this.listeners[type] = [];
      }
      this.listeners[type].push(callback);
    }

    close() {
      if (this.xhr) {
        this.xhr.abort();
      }
    }
  }

  // Main init function
  function initChatbot() {
    // Create container for the chatbot
    const container = document.createElement('div');
    container.className = 'my-gpt-chatbot-container';
    document.body.appendChild(container);

    // Show loading spinner
    container.innerHTML = `
      <div class="my-gpt-loading">
        <div class="my-gpt-spinner"></div>
      </div>
    `;

    // Get the script attributes
    const script = document.querySelector('script[data-chatbot-id]');
    const chatbotId = script ? script.getAttribute('data-chatbot-id') : null;
    const apiUrl = script ? script.getAttribute('data-api-url') || 'http://78.46.123.249/api' : 'http://78.46.123.249/api';
    
    // Fetch chatbot configuration
    fetch(`${apiUrl}/chatbot-info=${chatbotId}`)
      .then(response => response.json())
      .then(chatbotConfig => {
        if (!chatbotConfig || !chatbotConfig.id) {
          showInvalidConfig();
          return;
        }
        
        // Remove loading indicator
        container.innerHTML = '';
        
        // Create chat button
        const chatButton = document.createElement('div');
        chatButton.className = 'my-gpt-chat-button';
        chatButton.style.backgroundColor = chatbotConfig.color || '#3B82F6';
        chatButton.innerHTML = '<span class="my-gpt-chat-icon">💬</span>';
        container.appendChild(chatButton);
        
        // Create iframe for the chat
        const iframe = document.createElement('iframe');
        iframe.className = 'my-gpt-chatbot-frame';
        iframe.title = 'Chat';
        iframe.frameBorder = '0';
        container.appendChild(iframe);
        
        // Set up button click event
        chatButton.addEventListener('click', () => {
          iframe.style.display = 'block';
          chatButton.style.display = 'none';
          
          // If iframe isn't loaded yet, load the chatbot interface
          if (!iframe.src) {
            loadChatInterface(iframe, chatbotConfig, clientId, apiUrl);
          }
        });
        
        // Listen for close event from iframe
        window.addEventListener('message', (event) => {
          if (event.data === 'closeChatbot') {
            iframe.style.display = 'none';
            chatButton.style.display = 'flex';
          }
        });
      })
      .catch(error => {
        console.error('Error loading chatbot:', error);
        showInvalidConfig();
      });
  }

  // Show invalid configuration message
  function showInvalidConfig() {
    const container = document.querySelector('.my-gpt-chatbot-container');
    if (container) {
      container.innerHTML = `
        <div class="my-gpt-chat-button" style="background-color: white; cursor: not-allowed;">
          <span style="color: red;">❗</span>
        </div>
      `;
    }
  }

  // Load chat interface into iframe
  function loadChatInterface(iframe, chatbotConfig, clientId, apiUrl) {
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    
    // Add required styles and scripts to iframe
    doc.head.innerHTML = `
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Chat</title>
      <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/vue-material-design-icons/dist/vue-material-design-icons.css">
      <style>
        /* Add the same styles from your original component */
        .animate-fade-in {
          animation: fadeIn 0.3s ease-in-out;
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .prose {
          line-height: 1.6;
        }
        
        .prose pre {
          background-color: #f3f4f6;
          padding: 0.75rem;
          border-radius: 0.375rem;
          overflow-x: auto;
        }
        
        .prose code {
          background-color: #f3f4f6;
          padding: 0.125rem 0.25rem;
          border-radius: 0.25rem;
          font-size: 0.875em;
        }
        
        .prose a {
          color: #2563eb;
          text-decoration: underline;
        }
        
        .prose blockquote {
          border-left: 4px solid #d1d5db;
          padding-left: 1rem;
          font-style: italic;
        }
        
        .dark .prose pre {
          background-color: #1f2937;
        }
        
        .dark .prose code {
          background-color: #1f2937;
        }
        
        .dark .prose a {
          color: #60a5fa;
        }
        
        .dark .prose blockquote {
          border-left-color: #4b5563;
        }
      </style>
    `;

    // Create container for Vue app
    doc.body.innerHTML = '<div id="app"></div>';
    
    // Add Vue app script
    const script = doc.createElement('script');
    script.innerHTML = `
      // Make SSE available in the iframe
      ${SSE.toString()}
      
      // Wait for Vue to be loaded
      document.addEventListener('DOMContentLoaded', () => {
        if (!window.Vue || !window.marked) {
          console.error('Vue or marked not loaded');
          return;
        }
        
        const { ref, onMounted, computed, nextTick } = Vue;
        
        // Chatbot config from parent
        const chatbotConfig = ${JSON.stringify(chatbotConfig)};
        const clientId = "${clientId}";
        const apiUrl = "${apiUrl}";
        
        const app = Vue.createApp({
          setup() {
            const isLoadingMessage = ref(false);
            const thread_id = ref(null);
            const userMessage = ref("");
            const messages = ref([]);
            const chatContainerRef = ref(null);
            const isFullscreen = ref(window.innerWidth < 768);
            
            // Computed styles based on chatbot configuration
            const chatColor = computed(() => chatbotConfig.color || '#3B82F6');
            const chatInputClasses = computed(() => {
              return \`flex-grow px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-full 
                     focus:outline-none focus:ring-2 transition duration-200 ease-in-out 
                     bg-white dark:bg-gray-900 dark:text-white text-gray-900\`;
            });
            const placeholderText = computed(() => chatbotConfig.placeholder || 'Type your message here...');
            
            const containerClasses = computed(() => {
              const baseClasses = 'flex flex-col bg-white dark:bg-gray-800 overflow-hidden h-full transition-all duration-300 shadow-xl';
              
              if (isFullscreen.value) {
                return \`\${baseClasses} fixed inset-0 z-50 rounded-none\`;
              }
              
              return \`\${baseClasses} rounded-lg\`;
            });
            
            // Mobile detection
            onMounted(() => {
              window.addEventListener('resize', () => {
                const isMobile = window.innerWidth < 768;
                if (isMobile && !isFullscreen.value) {
                  isFullscreen.value = true;
                }
              });
              
              // Add initial welcome message
              if (chatbotConfig.first_text) {
                messages.value.push({
                  role: "assistant",
                  content: chatbotConfig.first_text,
                });
                
                nextTick(() => {
                  const msgElement = document.getElementById(\`\${clientId}chtbt_msg_0\`);
                  if (msgElement) {
                    msgElement.innerHTML = marked.parse(chatbotConfig.first_text);
                  }
                  scrollToBottom();
                  
                  // Focus the input field
                  const inputElement = document.getElementById(\`\${clientId}input\`);
                  if (inputElement) {
                    inputElement.focus();
                  }
                });
              }
            });
            
            // Scroll to bottom of chat container
            const scrollToBottom = () => {
              nextTick(() => {
                const chatContainer = chatContainerRef.value;
                if (chatContainer) {
                  chatContainer.scrollTop = chatContainer.scrollHeight;
                }
              });
            };
            
            // Toggle fullscreen mode
            const toggleFullscreen = () => {
              isFullscreen.value = !isFullscreen.value;
              nextTick(() => {
                scrollToBottom();
              });
            };
            
            // Close the chatbot
            const closeChat = () => {
              window.parent.postMessage('closeChatbot', '*');
            };
            
            // Send message to the chatbot
            const sendMessage = async () => {
              if (!userMessage.value.trim() || isLoadingMessage.value) return;
              
              const messageContent = userMessage.value.trim();
              messages.value.push({ role: "user", content: messageContent });
              userMessage.value = "";
              isLoadingMessage.value = true;
              
              scrollToBottom();
              
              try {
                const source = new SSE(\`\${apiUrl}/converse\`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream',
                  },
                  payload: JSON.stringify({
                    message: messageContent,
                    thread_id: thread_id.value,
                    client_id: clientId,
                  }),
                });
                
                // Add empty content message for streaming
                messages.value.push({ role: "assistant", content: '' });
                let wholeAssistantMessage = '';
                const currentMessageIndex = messages.value.length - 1;
                
                source.addEventListener('thread.run.completed', (e) => {
                  const msgElement = document.getElementById(\`\${clientId}chtbt_msg_\${currentMessageIndex}\`);
                  if (msgElement) {
                    msgElement.innerHTML = marked.parse(wholeAssistantMessage);
                    // Update the content property so it persists when switching tabs
                    messages.value[currentMessageIndex].content = wholeAssistantMessage;
                  }
                  source.close();
                });
                
                source.addEventListener('error', (error) => {
                  console.error('SSE error:', error);
                  source.close();
                });
                
                source.addEventListener('thread.message.delta', (event) => {
                  try {
                    isLoadingMessage.value = false;
                    const data = JSON.parse(event.data);
                    thread_id.value = data.threadId;
                    
                    wholeAssistantMessage += data.message;
                    const msgElement = document.getElementById(\`\${clientId}chtbt_msg_\${currentMessageIndex}\`);
                    if (msgElement) {
                      msgElement.innerHTML = marked.parse(wholeAssistantMessage);
                    }
                    scrollToBottom();
                  } catch (error) {
                    console.error('Error parsing event data:', event.data, error);
                  }
                });
                
                source.stream();
              } catch (error) {
                console.error("Error sending message:", error);
                messages.value.push({
                  role: "assistant",
                  content: "Sorry, I couldn't process your request. Please try again later."
                });
                isLoadingMessage.value = false;
              } finally {
                scrollToBottom();
              }
            };
            
            // Handle key press (Enter to send)
            const handleKeyDown = (e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            };
            
            // Clear chat
            const clearChat = () => {
              messages.value = [];
              if (chatbotConfig.first_text) {
                messages.value.push({
                  role: "assistant",
                  content: chatbotConfig.first_text,
                });
              }
              scrollToBottom();
            };
            
            return {
              isLoadingMessage,
              messages,
              userMessage,
              chatContainerRef,
              isFullscreen,
              chatColor,
              chatInputClasses,
              placeholderText,
              containerClasses,
              clientId,
              chatbotConfig,
              sendMessage,
              handleKeyDown,
              toggleFullscreen,
              closeChat,
              clearChat,
              scrollToBottom
            };
          }
        });
        
        app.mount('#app');
      });
    `;
    doc.body.appendChild(script);
    
    // Load required scripts in iframe
    const vueScript = doc.createElement('script');
    vueScript.src = 'https://cdn.jsdelivr.net/npm/vue@3/dist/vue.global.prod.js';
    doc.body.appendChild(vueScript);
    
    const markedScript = doc.createElement('script');
    markedScript.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
    doc.body.appendChild(markedScript);
    
    // Add the template HTML
    const templateScript = doc.createElement('script');
    templateScript.innerHTML = `
      document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('app').innerHTML = \`
          <div id="chatbot-container" class="flex flex-col bg-white dark:bg-gray-800 overflow-hidden h-full">
            <!-- Header -->
            <div class="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between"
              :style="\`background-color:\${chatColor}50;\`">
              <div class="flex items-center gap-3">
                <img class="w-8 h-8 rounded-full object-cover border-2 border-white shadow" :src="chatbotConfig.pfp"
                  :alt="chatbotConfig.name" />
                <span class="font-medium text-gray-900 dark:text-white">{{ chatbotConfig.name }}</span>
              </div>
              
              <div class="flex items-center gap-1">
                <button @click="toggleFullscreen"
                  class="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                  :title="isFullscreen ? 'Exit fullscreen' : 'Fullscreen'">
                  <svg v-if="isFullscreen" width="16" height="16" viewBox="0 0 24 24" fill="none"
                    xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 9H4V4M15 9H20V4M15 15H20V20M9 15H4V20" stroke="currentColor" stroke-width="2"
                      stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none"
                    xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 8V4H8M4 16V20H8M16 4H20V8M16 20H20V16" stroke="currentColor" stroke-width="2"
                      stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </button>
                
                <button @click="closeChat"
                  class="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                  title="Close chatbot">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
            
            <!-- Messages Container -->
            <div ref="chatContainerRef" class="p-4 space-y-3 overflow-y-auto bg-gray-50 dark:bg-gray-900 text-sm flex-grow">
              <div v-if="messages.length === 0" class="flex items-center justify-center h-full">
                <div class="text-center text-gray-500 dark:text-gray-400">
                  <p>Start a conversation with the chatbot</p>
                  <p class="text-xs mt-2">Your messages will appear here</p>
                </div>
              </div>
              
              <div v-for="(message, index) in messages" :key="index" class="mb-3 animate-fade-in">
                <!-- User Message -->
                <div v-if="message.role === 'user'" class="flex justify-end">
                  <div class="max-w-[75%]">
                    <p class="inline-block text-white p-3 rounded-lg rounded-tr-none shadow"
                      :style="\`background-color:\${chatColor};\`">
                      {{ message.content }}
                    </p>
                  </div>
                </div>
                
                <!-- Assistant Message -->
                <div v-else-if="message.role === 'assistant'" class="flex items-start gap-2 max-w-[85%]">
                  <img class="rounded-full w-8 h-8 mt-1 border border-gray-200 dark:border-gray-700"
                    :src="chatbotConfig.pfp || 'http://78.46.123.249/xiv337.png'" alt="Assistant" />
                  <div
                    class="inline-block bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-3 rounded-lg shadow rounded-tl-none border border-gray-200 dark:border-gray-700">
                    <!-- Use v-html for initial messages with content, and an id for streaming messages -->
                    <div v-if="message.content" v-html="marked.parse(message.content)"
                      class="prose prose-sm dark:prose-invert max-w-none break-words"></div>
                    <div v-else :id="\`\${clientId}chtbt_msg_\${index}\`"
                      class="prose prose-sm dark:prose-invert max-w-none break-words"></div>
                    
                    <div v-if="isLoadingMessage && index == messages.length - 1"
                      class="flex space-x-1 justify-center items-center p-1 mt-1">
                      <div
                        class="h-2 w-2 bg-gray-700 dark:bg-gray-300 rounded-full animate-bounce [animation-delay:-0.3s]">
                      </div>
                      <div
                        class="h-2 w-2 bg-gray-700 dark:bg-gray-300 rounded-full animate-bounce [animation-delay:-0.15s]">
                      </div>
                      <div class="h-2 w-2 bg-gray-700 dark:bg-gray-300 rounded-full animate-bounce"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Input Section -->
            <div
              class="p-3 border-t border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center gap-2 mt-auto">
              <input :id="\`\${clientId}input\`" type="text" :placeholder="placeholderText" v-model="userMessage"
                @keydown="handleKeyDown" class="flex-grow px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-full 
                focus:outline-none focus:ring-2 transition duration-200 ease-in-out 
                bg-white dark:bg-gray-900 dark:text-white text-gray-900"
                :style="\`focus:ring-[\${chatColor}];\`" />
              
              <button @click="sendMessage"
                class="p-3 rounded-full text-white transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                :disabled="isLoadingMessage || !userMessage.trim()" :style="\`background-color:\${chatColor};\`">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22 2L11 13M22 2L15 22L11 13M11 13L2 9L22 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
            
            <!-- Footer -->
            <div
              class="flex items-center justify-center text-gray-500 dark:text-gray-400 text-xs py-2 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
              <span>POWERED BY MY-GPT</span>
            </div>
          </div>
        \`;
      });
    `;
    doc.body.appendChild(templateScript);
  }

  // Load styles
  loadStyles();

  // Load dependencies and init the chatbot
  loadDependencies(initChatbot);
})();
