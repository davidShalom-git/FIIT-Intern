const express = require('express');
const axios = require('axios');
const { body, validationResult } = require('express-validator');
const Chat = require('../models/Chat');
const auth = require('../middleware/auth');

const router = express.Router();

// Gemini AI API configuration
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Validate API key
if (!GEMINI_API_KEY || !GEMINI_API_KEY.startsWith('AIza')) {
  console.error('Invalid or missing Gemini API key');
  process.exit(1);
}

// Update the text chat route
router.post('/text', [
  auth,
  body('prompt').trim().isLength({ min: 1, max: 2000 }).withMessage('Prompt must be 1-2000 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { prompt } = req.body;

    const payload = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      }
    };

    const geminiResponse = await axios.post(GEMINI_API_URL, payload, {
      headers: { 
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY
      },
      validateStatus: function (status) {
        return status < 500;
      }
    });

    if (geminiResponse.status !== 200) {
      console.error('Gemini API Error:', {
        status: geminiResponse.status,
        data: geminiResponse.data
      });
      throw new Error(geminiResponse.data.error?.message || 'Failed to get response from Gemini');
    }

    const response = geminiResponse.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!response) {
      throw new Error('Invalid response format from Gemini API');
    }

    const chat = new Chat({
      user: req.user._id,
      prompt,
      response,
      type: 'text',
      model: 'gemini-pro'
    });

    await chat.save();

    res.json({
      message: 'Text response generated successfully',
      data: {
        id: chat._id,
        prompt: chat.prompt,
        response: chat.response,
        type: chat.type,
        createdAt: chat.createdAt
      }
    });

  } catch (error) {
    console.error('Text chat error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });

    let statusCode = 500;
    let errorMessage = 'Error generating text response';

    if (error.response) {
      switch (error.response.status) {
        case 400:
          statusCode = 400;
          errorMessage = 'Invalid request to Gemini API';
          break;
        case 401:
          statusCode = 401;
          errorMessage = 'Invalid API key';
          break;
        case 429:
          statusCode = 429;
          errorMessage = 'Rate limit exceeded';
          break;
      }
    }

    res.status(statusCode).json({
      message: errorMessage,
      error: error.message
    });
  }
});
// Image description route using Gemini
router.post('/image', [
  auth,
  body('prompt').trim().isLength({ min: 1, max: 2000 }).withMessage('Prompt must be 1-2000 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { prompt } = req.body;

    const imagePrompt = `Describe in vivid detail the image I want: "${prompt}". Include specifics like colors, composition, lighting, style, and atmosphere.`;

    const payload = {
      contents: [{ parts: [{ text: imagePrompt }] }]
    };

    const geminiResponse = await axios.post(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, payload, {
      headers: { 'Content-Type': 'application/json' }
    });

    const response = geminiResponse.data.candidates[0]?.content?.parts[0]?.text || 'No response from Gemini';
    const imageUrl = `https://picsum.photos/512/512?random=${Date.now()}`;

    const chat = new Chat({
      user: req.user._id,
      prompt,
      response,
      type: 'image',
      imageUrl,
      model: 'gemini-pro'
    });

    await chat.save();

    res.json({
      message: 'Image description generated successfully',
      data: {
        id: chat._id,
        prompt: chat.prompt,
        response: chat.response,
        type: chat.type,
        imageUrl: chat.imageUrl,
        createdAt: chat.createdAt
      }
    });
  } catch (error) {
    console.error('Image generation error:', error.message);
    res.status(500).json({
      message: 'Error generating image description',
      error: error.message
    });
  }
});

// Get chat history
router.get('/history', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const chats = await Chat.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-user');

    const total = await Chat.countDocuments({ user: req.user._id });

    res.json({
      message: 'Chat history retrieved successfully',
      data: {
        chats,
        pagination: {
          current: page,
          total: Math.ceil(total / limit),
          limit,
          count: total
        }
      }
    });
  } catch (error) {
    console.error('Get history error:', error.message);
    res.status(500).json({ message: 'Error retrieving chat history' });
  }
});

// Delete chat
router.delete('/:id', auth, async (req, res) => {
  try {
    const chat = await Chat.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id
    });

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    res.json({ message: 'Chat deleted successfully' });
  } catch (error) {
    console.error('Delete chat error:', error.message);
    res.status(500).json({ message: 'Error deleting chat' });
  }
});

module.exports = router;