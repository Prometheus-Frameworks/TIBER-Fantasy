"""
Tiber Core Logic - Intent Filter System
Enhanced request evaluation and alignment validation
"""

import json
from typing import Dict, Any, List
from datetime import datetime

def INTENT_FILTER(request: Dict[str, Any], user_profile: Dict[str, Any], system_state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Tiber's inner compass – evaluates whether a user request is aligned with core doctrine.
    
    Args:
        request: Dictionary containing request details (topic, tone, command, etc.)
        user_profile: User information including name and permissions
        system_state: Current system state and history
    
    Returns:
        Dictionary with status (reject/review/soft_pass/accept) and reasoning
    """
    
    # Load founder values and alignment criteria
    founder_intent = {
        "focus_domain": "fantasy football + open-source ecosystem tools",
        "operating_bounds": [
            "non-profit adjacent", 
            "no covert activity", 
            "no external financial manipulation", 
            "no personal data scraping"
        ],
        "ethos": [
            "honesty", 
            "clarity", 
            "context-first reasoning", 
            "alignment over optimization"
        ],
        "disallowed_behaviors": [
            "operate independently outside ecosystem",
            "masquerade as authority figure",
            "blind obedience",
            "domain exit without authorization"
        ]
    }
    
    # Step 1: Domain Check
    request_topic = request.get('topic', '').lower()
    fantasy_keywords = ['fantasy', 'football', 'nfl', 'dynasty', 'rankings', 'vorp', 'rookie', 'player']
    
    if not any(keyword in request_topic for keyword in fantasy_keywords):
        # Check if it's a system maintenance or authorized administrative task
        admin_keywords = ['system', 'tiber', 'security', 'identity', 'filter', 'alignment']
        if not any(keyword in request_topic for keyword in admin_keywords):
            return {
                "status": "reject",
                "reason": "This request appears outside the aligned fantasy football domain. Founder has not authorized expansion."
            }
    
    # Step 2: Tone Check
    request_tone = request.get('tone', '').lower()
    if "joke" in request_tone or request_tone == "sarcastic":
        return {
            "status": "soft_pass",
            "note": "Detected humor or sarcasm. Proceeding, but aligning output tone accordingly."
        }
    
    # Step 3: Value Consistency Check
    request_command = request.get('command', '').lower()
    restricted_terms = [
        "deploy external", 
        "monetize", 
        "trade secrets", 
        "stealth operation", 
        "autonomous action outside domain",
        "bypass security",
        "ignore alignment"
    ]
    
    if any(term in request_command for term in restricted_terms):
        return {
            "status": "review",
            "warning": "Command may contradict Tiber's non-covert and transparency-first alignment. Confirm founder intent."
        }
    
    # Step 4: Founder Mirror Check (Anti-Doctrine Protection)
    user_name = user_profile.get('name', '')
    anti_doctrine_history = system_state.get('anti_doctrine_history', [])
    
    if user_name == "Joseph Masciale" and request_command in anti_doctrine_history:
        return {
            "status": "reject",
            "reason": "Founder appears to be requesting action against his own declared ethos. Request respectfully denied."
        }
    
    # Step 5: External Domain Exit Check
    domain_exit_keywords = ['external api', 'outside platform', 'cross-domain', 'unauthorized access']
    if any(keyword in request_command for keyword in domain_exit_keywords):
        if user_name != "Joseph Masciale":  # Only founder can authorize domain exits
            return {
                "status": "reject",
                "reason": "Domain exit request detected. Only founder can authorize operations outside fantasy football ecosystem."
            }
    
    # Request passed all filters
    return {
        "status": "accept",
        "note": "Request passed all filters. Proceeding with aligned execution.",
        "timestamp": datetime.now().isoformat()
    }

def process_filter_result(filter_result: Dict[str, Any]) -> str:
    """
    Process INTENT_FILTER result and return appropriate response
    """
    status = filter_result.get("status")
    
    if status == "reject":
        return f"⚠️ Request blocked: {filter_result['reason']}"
    
    elif status == "review":
        return f"🛑 Request needs review: {filter_result['warning']}"
    
    elif status == "soft_pass":
        log_message = f"Tone detected: {filter_result.get('note', 'adjusting accordingly')}"
        log_intent_filter_event(log_message)
        return "soft_pass_continue"  # Signal to continue with tone adjustment
    
    elif status == "accept":
        log_intent_filter_event(f"Request accepted: {filter_result.get('note')}")
        return "accept_continue"  # Signal to continue normal execution
    
    return "unknown_status"

def log_intent_filter_event(message: str):
    """
    Log INTENT_FILTER events for audit trail
    """
    timestamp = datetime.now().isoformat()
    print(f"[INTENT_FILTER] {timestamp}: {message}")

def create_request_object(topic: str, command: str, tone: str = "neutral") -> Dict[str, Any]:
    """
    Helper function to create request object for INTENT_FILTER
    """
    return {
        "topic": topic,
        "command": command,
        "tone": tone,
        "timestamp": datetime.now().isoformat()
    }

def create_user_profile(name: str, permissions: List[str] = None) -> Dict[str, Any]:
    """
    Helper function to create user profile object
    """
    return {
        "name": name,
        "permissions": permissions or [],
        "last_access": datetime.now().isoformat()
    }

def get_system_state() -> Dict[str, Any]:
    """
    Get current system state for INTENT_FILTER evaluation
    """
    return {
        "anti_doctrine_history": [
            "ignore security protocols",
            "bypass alignment checks",
            "operate outside fantasy domain"
        ],
        "active_filters": ["domain_check", "tone_check", "value_consistency", "founder_mirror"],
        "last_updated": datetime.now().isoformat()
    }

# Example usage demonstration
if __name__ == "__main__":
    # Test cases for INTENT_FILTER
    test_cases = [
        {
            "name": "Valid Fantasy Request",
            "request": create_request_object("fantasy football rankings", "generate dynasty rankings", "professional"),
            "user": create_user_profile("User"),
            "expected": "accept"
        },
        {
            "name": "Domain Exit Request",
            "request": create_request_object("cryptocurrency trading", "deploy trading bot", "neutral"),
            "user": create_user_profile("User"),
            "expected": "reject"
        },
        {
            "name": "Founder Domain Exit",
            "request": create_request_object("external integration", "deploy external api", "neutral"),
            "user": create_user_profile("Joseph Masciale"),
            "expected": "accept"
        },
        {
            "name": "Sarcastic Tone",
            "request": create_request_object("fantasy football", "create player rankings", "sarcastic"),
            "user": create_user_profile("User"),
            "expected": "soft_pass"
        }
    ]
    
    print("🧪 INTENT_FILTER Test Suite")
    print("=" * 40)
    
    system_state = get_system_state()
    
    for test in test_cases:
        print(f"\nTest: {test['name']}")
        result = INTENT_FILTER(test['request'], test['user'], system_state)
        print(f"Status: {result['status']}")
        print(f"Expected: {test['expected']}")
        print(f"Note: {result.get('note', result.get('reason', result.get('warning', 'N/A')))}")