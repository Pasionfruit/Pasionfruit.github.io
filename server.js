const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// MongoDB connection string for local MongoDB
const MONGODB_URI = 'mongodb://127.0.0.1:27017/recipe-db';

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// Recipe Schema
const recipeSchema = new mongoose.Schema({
    name: { type: String, required: true },
    image: { type: String, required: true },
    prepTime: { type: String, required: true },
    cookTime: { type: String, required: true },
    ingredients: [{ type: String, required: true }],
    instructions: [{ type: String, required: true }],
    tiktokLink: { type: String, required: true }
});

const Recipe = mongoose.model('Recipe', recipeSchema);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// API Routes
app.get('/api/recipes', async (req, res) => {
    try {
        const recipes = await Recipe.find();
        res.json(recipes);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching recipes', error: error.message });
    }
});

app.get('/api/recipes/:id', async (req, res) => {
    try {
        const recipe = await Recipe.findById(req.params.id);
        if (!recipe) {
            return res.status(404).json({ message: 'Recipe not found' });
        }
        res.json(recipe);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching recipe', error: error.message });
    }
});

// Serve the recipe page
app.get('/recipes', (req, res) => {
    res.sendFile(path.join(__dirname, 'recipes', 'recipe.html'));
});

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
}); 