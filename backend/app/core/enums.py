from enum import Enum


class UserRole(str, Enum):
    FREE = "free"
    PREMIUM = "premium"
    MODERATOR = "moderator"
    ADMIN = "admin"


class UserStatus(str, Enum):
    ACTIVE = "active"
    RESTRICTED = "restricted"
    BANNED = "banned"


class PostStatus(str, Enum):
    PUBLISHED = "published"
    HIDDEN = "hidden"
    REMOVED = "removed"


class AccessRequestStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    DENIED = "denied"


class ConversationStatus(str, Enum):
    ACTIVE = "active"
    BLOCKED = "blocked"
    REPORTED = "reported"


class MessageStatus(str, Enum):
    SENT = "sent"
    READ = "read"
    REMOVED = "removed"


class SubscriptionStatus(str, Enum):
    FREE = "free"
    PREMIUM = "premium"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class ReportStatus(str, Enum):
    OPEN = "open"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"


class ReportTargetType(str, Enum):
    PROFILE = "profile"
    POST = "post"
    CONVERSATION = "conversation"
    MESSAGE = "message"


class ReportReason(str, Enum):
    FAKE_ACCOUNT = "fake_account"
    NO_CONSENT = "no_consent"
    UNDERAGE = "underage"
    PROHIBITED = "prohibited"
    SPAM_OR_SCAM = "spam_or_scam"
    HARASSMENT = "harassment"
    COPYRIGHT = "copyright"
    OTHER = "other"
