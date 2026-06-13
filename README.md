# PhotoMagic Studio

A full-stack photo editing web application with JWT and OAuth2 authentication, built with React and FastAPI.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.136.3-009688?logo=fastapi)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![Python](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python)

---

## Features

- **JWT + OAuth2 Authentication** — Register, login, and secure sessions with Bearer tokens
- **10+ Photo Filters** — Brightness, contrast, saturation, blur, grayscale, sepia, hue rotate, invert, opacity
- **Transform Tools** — Rotate and flip images
- **Save Photos** — Save edited photos to your session
- **Download** — Export edited photos as PNG
- **Real-time Preview** — See filter changes instantly

---

## Tech Stack

| Frontend | Backend |
|---|---|
| React | FastAPI |
| Tailwind CSS | Python |
| Lucide React Icons | python-jose (JWT) |
| Canvas API | passlib + bcrypt |
| | OAuth2PasswordBearer |

---

## Folder Structure

```
Photomagic/
├── LICENSE
├── .gitignore
├── README.md
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   └── .env              <- create this locally (not pushed)
└── photo-editor/
    ├── public/
    ├── src/
    │   └── App.js
    ├── package.json
    └── tailwind.config.js
```

---

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- npm

---

### Backend Setup

```bash
# Navigate to backend folder
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment (Windows)
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

Create a `.env` file inside the `backend/` folder:

```env
SECRET_KEY=your-super-secret-random-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

To generate a secure `SECRET_KEY`:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Run the backend server:

```bash
uvicorn main:app --reload
```

Backend runs at `http://localhost:8000`  
Swagger docs at `http://localhost:8000/docs`

---

### Frontend Setup

```bash
# Navigate to frontend folder
cd photo-editor

# Install dependencies
npm install

# Start the app
npm start
```

Frontend runs at `http://localhost:3000`

---

## API Endpoints

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| GET | `/` | Health check | No |
| POST | `/register` | Create new account | No |
| POST | `/login` | Login and get JWT token | No |
| GET | `/me` | Get current user info | Yes |
| GET | `/protected` | Example protected route | Yes |

---

## How Authentication Works

1. User registers with email and password — password is hashed with **bcrypt**
2. User logs in — server verifies password and returns a **JWT Bearer token**
3. Frontend stores the token in `sessionStorage`
4. Every protected request sends `Authorization: Bearer <token>` in the header
5. Token expires after 30 minutes (configurable via `.env`)

---

## Usage

1. Register a new account or login with existing credentials
2. Upload an image using the Choose Image button
3. Adjust filters using the sliders on the left panel
4. Use Rotate or Flip to transform the image
5. Click Save to store the photo in your session or Download to export as PNG

---

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

---

## License

This project is licensed under the [MIT License](LICENSE).

---

## Author

**Rishav45-developer**  
GitHub: [@Rishav45-developer](https://github.com/Rishav45-developer)