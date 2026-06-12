from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from jose import jwt, JWTError
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
from pydantic import BaseModel
from dotenv import load_dotenv
import os

# ─── LOAD .env ────────────────────────────────────────────────────────────────
load_dotenv()

app = FastAPI()

# ─── CORS ────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── CONFIG (loaded from .env) ───────────────────────────────────────────────
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30))

if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY is not set in .env file!")

# ─── HASHING ─────────────────────────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

# ─── JWT ─────────────────────────────────────────────────────────────────────
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def create_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(token: str = Depends(oauth2_scheme)) -> str:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return username
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

# ─── IN-MEMORY USER DB (replace with a real DB later) ────────────────────────
# Structure: { "email": { "username": str, "hashed_password": str } }
fake_user_db: dict = {
    "admin": {
        "username": "admin",
        "hashed_password": pwd_context.hash("1234"),
    }
}

# ─── SCHEMAS ─────────────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    email: str
    password: str

# ─── ROUTES ──────────────────────────────────────────────────────────────────

@app.get("/")
def home():
    return {"message": "PhotoMagic JWT API is running 🚀"}


@app.post("/register")
def register(body: RegisterRequest):
    """Create a new account with email + password."""
    if body.email in fake_user_db:
        raise HTTPException(status_code=400, detail="Email already registered")
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    fake_user_db[body.email] = {
        "username": body.email,
        "hashed_password": hash_password(body.password),
    }
    return {"message": "Account created successfully"}


@app.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    OAuth2 password flow — accepts username (email) + password as form fields.
    Returns a Bearer JWT token.
    """
    user = fake_user_db.get(form_data.username)
    if not user or not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(status_code=400, detail="Invalid email or password")

    token = create_token({"sub": form_data.username})
    return {"access_token": token, "token_type": "bearer"}


@app.get("/protected")
def protected_route(username: str = Depends(verify_token)):
    """Example protected route — only reachable with a valid JWT."""
    return {"message": "Access granted!", "user": username}


@app.get("/me")
def me(username: str = Depends(verify_token)):
    """Return info about the currently logged-in user."""
    return {"email": username}