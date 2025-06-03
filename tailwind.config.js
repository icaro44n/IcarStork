 /** @type {import('tailwindcss').Config} */
    module.exports = {
      content: [
        "./src/**/*.{js,jsx,ts,tsx}",
        "./public/index.html",
      ],
      theme: {
        extend: {
          fontFamily: {
            sans: ['Inter', 'sans-serif'], // Define Inter como a fonte sans-serif padrão
          },
        },
      },
      plugins: [],
    }    
    module.exports = {
      plugins: {
        tailwindcss: {},
        autoprefixer: {},
      },
    };
    