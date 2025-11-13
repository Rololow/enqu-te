# Rust Backend Implementation Notes

## Current Status

### ✅ Completed
1. **Project Structure**
   - Cargo workspace initialized
   - Module organization (models, handlers, middleware, utils, error)
   - Development and production configurations

2. **Database Models**
   - User model with authentication fields
   - Investigation model with unique code generation
   - Entity model (people, locations, evidence, events)
   - Link model for bidirectional entity connections
   - Tag, Comment, and Attachment models
   - Full SQLx integration with PostgreSQL

3. **Authentication System**
   - JWT-based authentication
   - Bcrypt password hashing
   - Token generation and verification
   - Claims extractor for protected routes
   - Authentication middleware

4. **API Endpoints**
   - **Auth**: Register, Login, Get Current User
   - **Investigations**: List, Create, Get, Join (by code), Get Members, Update Presence
   - **Entities**: List (with filtering), Create, Update, Delete
   - **Links**: List, Create, Delete
   - All endpoints follow RESTful conventions

5. **Middleware & Security**
   - CORS configuration
   - JWT authentication middleware
   - Error handling with proper HTTP status codes
   - Input validation via Rust type system

6. **Utilities**
   - Investigation code generator (8-character alphanumeric)
   - Password hashing and verification
   - JWT creation and verification
   - Tag resolution with case-insensitive matching

7. **Documentation**
   - Comprehensive README with API documentation
   - Example .env file
   - Migration SQL files

### ⚠️ Known Issues

1. **Compile-Time Query Verification**
   - SQLx macros (`sqlx::query!`) require database connection at compile time
   - **Solutions**:
     a. Set up `DATABASE_URL` environment variable before building
     b. Use `sqlx prepare` to generate offline query metadata
     c. Convert to runtime queries (`sqlx::query` without macro)
   
   For now, to build:
   ```bash
   # Option 1: Provide DATABASE_URL
   export DATABASE_URL="postgresql://user:pass@localhost/dbname"
   cargo build
   
   # Option 2: Use sqlx offline mode
   cargo sqlx prepare
   cargo build --offline
   ```

2. **File Upload Handlers**
   - Avatar upload endpoint not yet implemented
   - Entity photo upload endpoint not yet implemented
   - Attachment upload endpoint not yet implemented
   - These require multipart/form-data handling (supported by Axum)

3. **Additional Features**
   - Comment CRUD endpoints not yet implemented
   - Investigation deletion endpoint present in Django but not fully tested
   - Member revocation with code regeneration not yet implemented

### 📋 TODO

1. **Complete Missing Endpoints**
   - [ ] Comment endpoints (create, list, update, delete)
   - [ ] File upload endpoints (avatars, photos, attachments)
   - [ ] Investigation settings/update endpoint
   - [ ] Member role management
   - [ ] Investigation code regeneration

2. **Testing**
   - [ ] Integration tests for all endpoints
   - [ ] Unit tests for business logic
   - [ ] Load testing and benchmarks
   - [ ] Test database setup scripts

3. **Security Enhancements**
   - [ ] Rate limiting middleware
   - [ ] CSRF protection for cookie-based auth (if needed)
   - [ ] Input sanitization for user-generated content
   - [ ] SQL injection prevention verification
   - [ ] XSS prevention in JSON responses

4. **Performance Optimization**
   - [ ] Database query optimization
   - [ ] Connection pooling tuning
   - [ ] Caching strategy (Redis integration?)
   - [ ] Response compression

5. **Deployment Preparation**
   - [ ] Docker configuration
   - [ ] CI/CD pipeline (GitHub Actions)
   - [ ] Production environment configuration
   - [ ] Logging and monitoring setup
   - [ ] Health check endpoint improvements

6. **Migration Tools**
   - [ ] Data migration scripts from Django
   - [ ] Schema compatibility verification
   - [ ] Rollback procedures

## Architecture Decisions

### Why Axum?
- Modern, ergonomic API
- Excellent performance (built on Hyper)
- Strong type safety
- Good ecosystem support
- Active development and community

### Why SQLx?
- Compile-time query verification (when available)
- Async/await native support
- No heavyweight ORM overhead
- Direct SQL for complex queries
- PostgreSQL-specific features support

### Why JWT for Auth?
- Stateless authentication
- Works well with REST APIs
- Easy to integrate with frontend
- Scalable (no server-side sessions)
- Compatible with microservices

## Performance Expectations

Based on similar Rust web applications:

- **Response Time**: ~1-5ms for simple queries (vs ~10-20ms Django)
- **Throughput**: ~50,000-100,000 req/s per core (vs ~1,000-5,000 Django)
- **Memory**: ~50-100MB baseline (vs ~200-500MB Django)
- **Concurrent Connections**: 10,000+ (vs ~100-500 Django with workers)

## API Compatibility

The Rust backend is designed to be 100% API-compatible with the Django frontend:

1. **Same URL patterns**: `/api/auth/`, `/api/investigations/`, etc.
2. **Same JSON structure**: Response formats match Django REST Framework
3. **Same authentication**: JWT tokens work the same way
4. **Same error responses**: HTTP status codes and error format

This allows for:
- Gradual migration
- A/B testing
- Running both backends simultaneously
- Easy rollback if needed

## Database Schema

Uses the exact same PostgreSQL schema as Django:
- Table names: `investigation_*`
- Column types match Django's ORM mapping
- Foreign key relationships preserved
- Indexes maintained

This ensures:
- Zero downtime migration possible
- Data consistency
- Shared database between Django and Rust (during transition)

## Development Workflow

1. **Local Development**:
   ```bash
   # Set up database
   createdb investigation_db
   # Set environment
   cp .env.example .env
   # Edit .env with your settings
   
   # Run migrations (if starting fresh)
   sqlx migrate run
   
   # Run development server
   cargo run
   ```

2. **Making Changes**:
   ```bash
   # Check code
   cargo check
   
   # Run tests
   cargo test
   
   # Format code
   cargo fmt
   
   # Lint code
   cargo clippy
   ```

3. **Adding Endpoints**:
   - Add handler function in `src/handlers/`
   - Add route in `src/main.rs`
   - Update models if needed in `src/models/`
   - Add tests in `tests/`

## Next Steps

1. **Immediate**: Fix compile-time verification by setting up offline mode or converting to runtime queries
2. **Short-term**: Implement file upload endpoints
3. **Medium-term**: Complete test coverage
4. **Long-term**: Production deployment and monitoring

## Resources

- [Axum Documentation](https://docs.rs/axum/)
- [SQLx Documentation](https://docs.rs/sqlx/)
- [Tokio Documentation](https://docs.rs/tokio/)
- [Rust Async Book](https://rust-lang.github.io/async-book/)
