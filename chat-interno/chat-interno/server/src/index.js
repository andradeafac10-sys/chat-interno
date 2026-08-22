@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root { height: 100%; margin: 0; }
body { background: #111B21; }

@keyframes flash-new-message {
  0%, 100% { background-color: transparent; }
  50% { background-color: rgba(37, 211, 102, 0.28); }
}
.flash-new-message {
  animation: flash-new-message 1s ease-in-out infinite;
}
