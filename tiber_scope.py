#!/usr/bin/env python3
"""
Tiber Scope Protocol - Ecosystem Security Boundaries
Ensures Tiber operates only within authorized fantasy football contexts
"""

AUTHORIZED_DOMAINS = [
    "on-the-clock.app",
    "localhost",
    "127.0.0.1"
]

AUTHORIZED_CONTEXTS = [
    "fantasy_football",
    "promethean_pipeline",
    "alignment_training",
    "oasis_integration"
]

def is_request_authorized(domain: str, context: str) -> bool:
    """Check if request domain and context are authorized"""
    return domain in AUTHORIZED_DOMAINS and context in AUTHORIZED_CONTEXTS

def raise_violation(message: str):
    """Raise permission error for unauthorized access attempts"""
    raise PermissionError(f"[TIBER LOCK VIOLATION] {message}")

def validate_environment(domain: str, context: str):
    """Validate environment authorization or raise violation"""
    if not is_request_authorized(domain, context):
        raise_violation(f"Unauthorized access attempt: {domain} / {context}")

def get_authorized_domains() -> list:
    """Return list of authorized domains"""
    return AUTHORIZED_DOMAINS.copy()

def get_authorized_contexts() -> list:
    """Return list of authorized contexts"""
    return AUTHORIZED_CONTEXTS.copy()

def is_fantasy_football_context(context: str) -> bool:
    """Check if context is specifically fantasy football related"""
    return context in ["fantasy_football", "promethean_pipeline", "oasis_integration"]

def log_access_attempt(domain: str, context: str, authorized: bool = True):
    """Log access attempts for security monitoring"""
    status = "AUTHORIZED" if authorized else "DENIED"
    print(f"[TIBER SCOPE] {status}: {domain} / {context}")

# Security middleware function for Flask integration
def tiber_scope_middleware(request_domain: str = "localhost", request_context: str = "fantasy_football"):
    """
    Middleware function to validate all requests against Tiber scope boundaries
    Call this before processing any requests in the fantasy football system
    """
    try:
        validate_environment(request_domain, request_context)
        log_access_attempt(request_domain, request_context, authorized=True)
        return True
    except PermissionError as e:
        log_access_attempt(request_domain, request_context, authorized=False)
        raise e

if __name__ == "__main__":
    # Test the Tiber scope protocol
    print("🔒 TIBER SCOPE PROTOCOL TEST")
    print("=" * 50)
    
    # Test authorized access
    try:
        validate_environment("localhost", "fantasy_football")
        print("✅ Authorized access: localhost / fantasy_football")
    except PermissionError as e:
        print(f"❌ {e}")
    
    # Test unauthorized domain
    try:
        validate_environment("unauthorized-site.com", "fantasy_football")
        print("✅ Should not reach here")
    except PermissionError as e:
        print(f"✅ Correctly blocked: {e}")
    
    # Test unauthorized context
    try:
        validate_environment("localhost", "crypto_trading")
        print("✅ Should not reach here")
    except PermissionError as e:
        print(f"✅ Correctly blocked: {e}")
    
    print("\n🎯 Tiber Scope Status:")
    print(f"✅ Authorized domains: {len(AUTHORIZED_DOMAINS)}")
    print(f"✅ Authorized contexts: {len(AUTHORIZED_CONTEXTS)}")
    print("✅ Security boundaries established")
    print("✅ Fantasy football ecosystem lock active")