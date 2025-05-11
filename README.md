# Delicious Recipes Website

A modern, responsive recipe website built with HTML, CSS, and JavaScript. This website is designed to be hosted on GitHub Pages.

## Features

- Responsive design that works on all devices
- Modern and clean user interface
- Smooth animations and transitions
- Recipe categories and search functionality
- Detailed recipe pages with ingredients and instructions
- Social media integration

## Project Structure

```
.
├── index.html              # Main homepage
├── styles.css             # Main stylesheet
├── script.js             # JavaScript functionality
├── images/              # Image assets
│   ├── hero-bg.jpg
│   ├── placeholder1.jpg
│   ├── placeholder2.jpg
│   └── placeholder3.jpg
└── recipes/            # Individual recipe pages
    ├── chocolate-cake.html
    ├── pizza.html
    └── pasta.html
```

## Deployment

This website is designed to be deployed on GitHub Pages. To deploy:

1. Create a new repository on GitHub
2. Name it `yourusername.github.io`
3. Push this code to the repository
4. Enable GitHub Pages in the repository settings
5. Your site will be available at `https://yourusername.github.io`

## Local Development

To run the website locally:

1. Clone the repository
2. Open `index.html` in your web browser
3. For live reload during development, you can use Python's built-in HTTP server:
   ```bash
   python -m http.server 8000
   ```
   Then visit `http://localhost:8000` in your browser

## Adding New Recipes

To add a new recipe:

1. Create a new HTML file in the `recipes` directory
2. Copy the structure from an existing recipe file
3. Update the content with your recipe details
4. Add any new images to the `images` directory
5. Update the main page (`index.html`) to include your new recipe in the featured recipes section

## Customization

- Colors and styling can be modified in `styles.css`
- Fonts can be changed by updating the font-family properties
- Images can be replaced in the `images` directory
- Social media links can be updated in the footer section

## Contributing

Feel free to submit issues and enhancement requests!

## License

This project is licensed under the MIT License - see the LICENSE file for details. 