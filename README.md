# Think & Type 🎮⏱️

The ultimate quick-thinking party game where players race against the clock to type a Name, Place, Animal, and Thing starting with a specific letter!

## Features

- **Real-Time Multiplayer**: Built on Socket.IO for instantaneous syncing.
- **Smart Validation**: Integrated with Google's Gemini AI to validate answers accurately.
- **Host Controls**: Full control over room creation, round durations, and game progression.
- **Link-Based Joining**: Invite players easily via a shareable URL.
- **Excel Export**: Download match results and statistics directly to an Excel sheet.

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Node.js + Express
- **Sockets**: Socket.IO
- **AI Integration**: @google/genai (Gemini)

---

## 🛠️ Setup Instructions

### 1. Backend Setup

Open a terminal and navigate to the server folder:

```bash
cd server
npm install
```

Configure your environment variables:
1. Duplicate `server/.env.example` and rename it to `server/.env`
2. Add your Gemini API key:
```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3001
CLIENT_URL=http://localhost:5173
```

Start the backend:
```bash
npm run dev
```

### 2. Frontend Setup

Open a new terminal and navigate to the client folder:

```bash
cd client
npm install
```

Configure your environment variables:
1. Duplicate `client/.env.example` and rename it to `client/.env`
2. Ensure it points to your backend:
```env
VITE_SERVER_URL=http://localhost:3001
```

Start the frontend:
```bash
npm run dev
```

---

## 🚀 Deployment Instructions

### Deploying the Backend (Render / Heroku / Railway)
1. Set the Build Command to: `npm install`
2. Set the Start Command to: `node index.js`
3. Make sure the Root Directory is set to `server`
4. Add the following Environment Variables in your hosting provider's dashboard:
   - `GEMINI_API_KEY`
   - `CLIENT_URL` (Set this to your deployed frontend URL)
   - `PORT` (Usually handled automatically by providers like Render)

### Deploying the Frontend (Netlify / Vercel)
1. Set the Build Command to: `npm run build`
2. Set the Publish Directory to: `dist`
3. Make sure the Root Directory is set to `client`
4. Add the following Environment Variables:
   - `VITE_SERVER_URL` (Set this to your deployed backend URL)

---

## Environment Variables Report

### Backend (`server/.env`)
- `GEMINI_API_KEY`: **Required** - Used by `services/validationService.js` to validate answers via AI.
- `PORT`: **Optional** - Defaults to `3001` if not provided.
- `CLIENT_URL`: **Optional** - Used to configure CORS. Defaults to `http://localhost:5173`.

### Frontend (`client/.env`)
- `VITE_SERVER_URL`: **Optional** - Used to configure the Socket.IO connection. Defaults to `http://localhost:3001` (or local IP if configured).

---

*Built for high-energy fun and quick thinking.*
