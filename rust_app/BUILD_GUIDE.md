# Build Guide - Rust Backend

## Quick Start

### Prerequisites
```bash
# Install Rust (if not already installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install PostgreSQL (if not already installed)
# On Ubuntu/Debian:
sudo apt-get install postgresql postgresql-contrib

# On macOS:
brew install postgresql
```

### Building Without Database (Offline Mode)

The project uses SQLx with compile-time query verification, which normally requires a database connection during compilation. Here are your options:

#### Option 1: Skip Compile-Time Verification (Fastest for Development)

The easiest way is to temporarily disable compile-time verification:

1. Edit `Cargo.toml` and remove "macros" from sqlx features (already done in this build)
2. Or set environment variable:
   ```bash
   export SQLX_OFFLINE=true
   cargo build
   ```

#### Option 2: Provide Database Connection

```bash
# Set up PostgreSQL database
createdb investigation_db

# Set DATABASE_URL
export DATABASE_URL="postgresql://postgres:password@localhost/investigation_db"

# Run Django migrations first (to create tables)
cd ../django_app
python manage.py migrate
cd ../rust_app

# Build with query verification
cargo build
```

#### Option 3: Use Prepared Queries (Recommended for CI/CD)

```bash
# One-time setup: prepare queries with database connection
export DATABASE_URL="postgresql://postgres:password@localhost/investigation_db"
cargo sqlx prepare

# This creates .sqlx/ directory with query metadata
# Now you can build offline:
cargo build --offline
```

### Building for Production

```bash
# Build optimized release binary
cargo build --release

# Binary will be at:
./target/release/enquete_backend
```

### Testing the Build

```bash
# Run tests
cargo test

# Check code quality
cargo clippy

# Format code
cargo fmt --check
```

## Configuration

### Environment Variables

Create a `.env` file (or export these variables):

```env
# Database Configuration
DATABASE_URL=postgresql://postgres:password@localhost:5432/investigation_db

# JWT Secret (CHANGE IN PRODUCTION!)
JWT_SECRET=your-secret-key-here-change-this-in-production

# Server Configuration
HOST=127.0.0.1
PORT=8080

# Logging
RUST_LOG=enquete_backend=debug,tower_http=debug
```

### Running the Server

```bash
# Development mode (with hot reload using cargo-watch)
cargo install cargo-watch
cargo watch -x run

# Or just run directly
cargo run

# Production mode
cargo run --release
```

The server will start on `http://127.0.0.1:8080` (or your configured HOST:PORT).

## Troubleshooting

### "DATABASE_URL not found" Error

```bash
# Solution: Set the environment variable
export DATABASE_URL="postgresql://user:password@localhost/investigation_db"
```

### "Cannot connect to database" Error

```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Or on macOS:
brew services list

# Test connection manually
psql -U postgres -d investigation_db
```

### Compile Errors Related to SQLx

```bash
# Clear build cache and try again
cargo clean
cargo build

# Or use offline mode
export SQLX_OFFLINE=true
cargo build
```

### "Table does not exist" Errors at Runtime

```bash
# Run migrations
sqlx migrate run

# Or use Django migrations
cd ../django_app
python manage.py migrate
```

## Docker Build (Optional)

```dockerfile
# Create a Dockerfile
FROM rust:1.75 as builder
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY migrations ./migrations
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y libpq5 ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/enquete_backend /usr/local/bin/
EXPOSE 8080
CMD ["enquete_backend"]
```

Build and run:
```bash
docker build -t enquete-backend .
docker run -p 8080:8080 --env-file .env enquete-backend
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Build and Test

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: investigation_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Install Rust
        uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
          override: true
      
      - name: Cache cargo
        uses: actions/cache@v3
        with:
          path: |
            ~/.cargo/registry
            ~/.cargo/git
            target
          key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}
      
      - name: Set up database
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/investigation_db
        run: |
          cargo install sqlx-cli --no-default-features --features postgres
          cargo sqlx migrate run
      
      - name: Build
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/investigation_db
        run: cargo build --release
      
      - name: Test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/investigation_db
        run: cargo test
```

## Performance Benchmarks

After building, you can benchmark the API:

```bash
# Install wrk (HTTP benchmarking tool)
# Ubuntu/Debian:
sudo apt-get install wrk

# macOS:
brew install wrk

# Run benchmark
wrk -t12 -c400 -d30s http://127.0.0.1:8080/health

# Test authenticated endpoint (replace TOKEN with actual JWT)
wrk -t12 -c400 -d30s -H "Authorization: Bearer TOKEN" http://127.0.0.1:8080/api/investigations
```

Expected results (on modern hardware):
- **Health endpoint**: ~50,000-100,000 req/s
- **Authenticated endpoints**: ~20,000-40,000 req/s
- **Database queries**: ~5,000-15,000 req/s

## Next Steps

After successful build:

1. ✅ Server runs on configured port
2. Test authentication: `POST /api/auth/register`
3. Create investigation: `POST /api/investigations`
4. Test CRUD operations
5. Monitor logs for errors
6. Check database for data consistency

For development, refer to `IMPLEMENTATION_NOTES.md` for architecture details and `README.md` for API documentation.
