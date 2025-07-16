import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { 
  Send, 
  Image, 
  MessageCircle, 
  LogOut, 
  User, 
  Trash2, 
  Bot,
  RefreshCw 
} from 'lucide-react';

function Dashboard() {
  const { user, logout } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatType, setChatType] = useState('text');
  const [history, setHistory] = useState([]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchChatHistory();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchChatHistory = async () => {
    try {
      const response = await axios.get('https://fiit-intern.vercel.app/api/chat/history?limit=10');
      setHistory(response.data.data.chats);
    } catch (error) {
      console.error('Error fetching chat history:', error);
    }
  };

 const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage = {
      id: Date.now(),
      content: inputMessage,
      type: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const endpoint = chatType === 'text' 
        ? 'https://fiit-intern.vercel.app/api/chat/text' 
        : 'https://fiit-intern.vercel.app/api/chat/image';

      // Add request headers and log request data
      const config = {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      };

      // Log request details
      console.log('Sending request to:', endpoint);
      console.log('Request data:', { prompt: inputMessage });

      const response = await axios.post(endpoint, {
        prompt: inputMessage
      }, config);

      // Log successful response
      console.log('Response received:', response.data);

      const botMessage = {
        id: Date.now() + 1,
        content: response.data.data.response,
        type: 'bot',
        chatType: response.data.data.type,
        imageUrl: response.data.data.imageUrl,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMessage]);
      fetchChatHistory();
      toast.success(`${chatType === 'text' ? 'Text' : 'Image'} response generated!`);

    } catch (error) {
      // Enhanced error handling
      console.error('Error details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data
      });

      // Show more specific error message to user
      let errorMessage = 'Failed to send message';
      if (error.response) {
        if (error.response.status === 500) {
          errorMessage = 'Server error. Please try again later.';
        } else if (error.response.status === 401) {
          errorMessage = 'Please login again.';
          logout(); // Assuming you have access to the logout function
        } else {
          errorMessage = error.response.data?.message || errorMessage;
        }
      } else if (error.request) {
        errorMessage = 'No response from server. Check your connection.';
      }

      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
      setInputMessage('');
    }
};

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    toast.success('Chat cleared');
  };

  const deleteHistoryItem = async (id) => {
    try {
      await axios.delete(`https://fiit-intern.vercel.app/api/chat/${id}`);
      fetchChatHistory();
      toast.success('Chat deleted');
    } catch (error) {
      toast.error('Failed to delete chat');
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <div className="w-1/4 bg-white shadow-lg">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <User className="w-8 h-8 text-purple-600" />
              <div>
                <h2 className="font-semibold text-gray-800">{user?.username}</h2>
                <p className="text-sm text-gray-600">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="p-2 text-gray-600 hover:text-red-600 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Chat History</h3>
            <button
              onClick={fetchChatHistory}
              className="p-1 text-gray-600 hover:text-purple-600 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {history.map((chat) => (
              <div
                key={chat._id}
                className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-gray-800 truncate">
                      {chat.prompt.substring(0, 50)}...
                    </p>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        chat.type === 'text' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {chat.type}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatTimestamp(chat.createdAt)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteHistoryItem(chat._id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-red-600 hover:text-red-800 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {history.length === 0 && (
              <p className="text-gray-500 text-center py-4">No chat history yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white shadow-sm p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-800">Gemini ChatBot</h1>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Mode:</span>
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setChatType('text')}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      chatType === 'text'
                        ? 'bg-purple-600 text-white'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    <MessageCircle className="w-4 h-4 inline mr-1" />
                    Text
                  </button>
                  <button
                    onClick={() => setChatType('image')}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      chatType === 'image'
                        ? 'bg-purple-600 text-white'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    <Image className="w-4 h-4 inline mr-1" />
                    Image
                  </button>
                </div>
              </div>
              <button
                onClick={clearChat}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Clear Chat
              </button>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 mt-20">
              <Bot className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-xl font-semibold mb-2">Welcome to Gemini ChatBot</h3>
              <p>Start a conversation by typing a message below</p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-3xl px-4 py-2 rounded-lg ${
                    message.type === 'user'
                      ? 'bg-purple-600 text-white'
                      : 'bg-white text-gray-800 shadow-sm border border-gray-200'
                  }`}
                >
                  {message.type === 'bot' && (
                    <div className="flex items-center space-x-2 mb-2">
                      <Bot className="w-5 h-5 text-purple-600" />
                      <span className="text-sm font-medium text-purple-600">Gemini</span>
                    </div>
                  )}
                  
                  <div className="whitespace-pre-wrap">{message.content}</div>
                  
                  {message.imageUrl && (
                    <div className="mt-2">
                      <img 
                        src={message.imageUrl} 
                        alt="Generated" 
                        className="max-w-full rounded-lg shadow-md"
                      />
                    </div>
                  )}
                  
                  <div className={`text-xs mt-1 ${
                    message.type === 'user' ? 'text-purple-200' : 'text-gray-500'
                  }`}>
                    {formatTimestamp(message.timestamp)}
                  </div>
                </div>
              </div>
            ))
          )}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-3xl px-4 py-2 bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center space-x-2 mb-2">
                  <Bot className="w-5 h-5 text-purple-600" />
                  <span className="text-sm font-medium text-purple-600">Gemini</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                  <span className="text-gray-600">
                    {chatType === 'text' ? 'Thinking...' : 'Generating image description...'}
                  </span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="bg-white border-t border-gray-200 p-4">
          <div className="flex items-end space-x-2">
            <div className="flex-1">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={
                  chatType === 'text' 
                    ? 'Ask Gemini anything...' 
                    : 'Describe the image you want to generate...'
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                rows="3"
                disabled={isLoading}
              />
            </div>
            <button
              onClick={handleSendMessage}
              disabled={isLoading || !inputMessage.trim()}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              <Send className="w-5 h-5" />
              <span>Send</span>
            </button>
          </div>
          
          <div className="mt-2 text-xs text-gray-500 text-center">
            {chatType === 'text' ? 'Text chat mode' : 'Image description mode'} • 
            Press Enter to send, Shift+Enter for new line
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;