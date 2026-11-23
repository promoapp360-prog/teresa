/** @type {import('tailwindcss').Config} */
export default {
  content: ["./client/index.html", "./client/src/**/*.{ts,tsx}", "./shared/**/*.ts"],
  theme: {
    extend: {
      colors: {
        brand: {
          ink: "#16302D",      // testo principale
          deep: "#24524C",     // verde salvia scuro
          sage: "#5E8C7F",     // salvia
          mist: "#E7EFEC",     // salvia chiarissimo
          cream: "#F8F4EE",    // sfondo caldo
          sand: "#EADFCF",
          bronze: "#B07D4F",   // accento
        },
      },
      fontFamily: {
        sans: ["Poppins", "system-ui", "sans-serif"],
        display: ["Poppins", "system-ui", "sans-serif"],
      },
      boxShadow: { soft: "0 10px 30px -14px rgba(22,48,45,.28)" },
    },
  },
  plugins: [],
};
