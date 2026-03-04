import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import bcrypt from "bcrypt";
import session from "express-session";
import connectPg from "connect-pg-simple";
import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";

// Extend session type to include intendedRole
declare module 'express-session' {
  interface SessionData {
    intendedRole?: 'adopter' | 'shelter';
  }
}

// Session configuration
export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });

  const isProduction = process.env.NODE_ENV === "production";

  return session({
    secret: process.env.SESSION_SECRET || "scout-development-secret-change-in-production",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: sessionTtl,
    },
  });
}

// Setup authentication middleware
export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure LocalStrategy for email/password authentication
  passport.use(
    new LocalStrategy(
      {
        usernameField: 'email',
        passwordField: 'password',
      },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          console.log("[Auth] getUserByEmail returned:", user ? { email: user.email, hasPassword: !!user.password, passwordLength: user.password?.length } : null);

          if (!user) {
            return done(null, false, { message: 'Incorrect email or password.' });
          }

          if (!user.password) {
            console.log("[Auth] User has no password field!");
            return done(null, false, { message: 'This account exists but has no password. Please sign up again to set a password, or use a different email address.' });
          }

          const isValidPassword = await bcrypt.compare(password, user.password);

          if (!isValidPassword) {
            return done(null, false, { message: 'Incorrect email or password.' });
          }

          // Return user object for session
          // Handle both snake_case and camelCase DB properties
          return done(null, {
            id: user.id,
            email: user.email,
            role: user.role,
            firstName: user.firstName,
            lastName: user.lastName,
            profileImageUrl: user.profileImageUrl,
            isAdmin: user.isAdmin || (user as any).is_admin,
            isActive: user.isActive || (user as any).is_active,
          });
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  // Configure Google OAuth Strategy
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: `${process.env.BASE_URL || 'http://localhost:5000'}/api/auth/google/callback`,
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value;
            if (!email) {
              return done(null, false, { message: 'No email found in Google profile' });
            }

            // Check if user exists
            let user = await storage.getUserByEmail(email);

            if (!user) {
              // Create new user
              const names = profile.displayName?.split(' ') || ['', ''];
              // Use intended role from session or default to adopter
              const intendedRole = (profile as any).session?.intendedRole || 'adopter';
              user = await storage.createUser({
                email,
                password: null, // OAuth users don't have passwords
                firstName: profile.name?.givenName || names[0] || 'User',
                lastName: profile.name?.familyName || names[1] || '',
                role: intendedRole,
                profileImageUrl: profile.photos?.[0]?.value || null,
              });
            }

            return done(null, {
              id: user.id,
              email: user.email,
              role: user.role,
              firstName: user.firstName,
              lastName: user.lastName,
              profileImageUrl: user.profileImageUrl,
              isAdmin: user.isAdmin || (user as any).is_admin,
              isActive: user.isActive || (user as any).is_active,
            });
          } catch (error) {
            return done(error);
          }
        }
      )
    );
  }

  // Serialize user to session
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        return done(null, false);
      }
      // Handle both snake_case and camelCase DB properties
      done(null, {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
        isAdmin: user.isAdmin || (user as any).is_admin,
        isActive: user.isActive || (user as any).is_active,
      });
    } catch (error) {
      done(error);
    }
  });
}

// Middleware to check if user is authenticated
export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
}

// Middleware to check if user is an admin
export async function isAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  try {
    const user = await storage.getUser((req.user as any).id);
    // Handle both snake_case and camelCase DB properties
    const isAdmin = user?.isAdmin || (user as any)?.is_admin;
    const isActive = user?.isActive || (user as any)?.is_active;
    
    if (!user || !isAdmin || !isActive) {
      return res.status(403).json({ message: "Forbidden - Admin access required" });
    }
    next();
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
}

// Helper to hash passwords
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12); // 12 rounds for security
}

// Helper to validate password strength
export function validatePassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: "Password must be at least 8 characters long" };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: "Password must contain at least one uppercase letter" };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: "Password must contain at least one lowercase letter" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: "Password must contain at least one number" };
  }
  return { valid: true };
}

// Admin Role Types
export type AdminRole = 'platform_admin' | 'trust_safety' | 'shelter_admin' | 'ai_ops';

// Helper to get user's admin role from database
async function getUserAdminRole(userId: string): Promise<AdminRole | null> {
  const user = await storage.getUser(userId);
  if (!user) return null;
  return (user.adminRole as AdminRole) || null;
}

// Middleware: Platform Admin - Super admin with full governance powers
export async function isPlatformAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  try {
    const adminRole = await getUserAdminRole((req.user as any).id);
    if (adminRole !== 'platform_admin') {
      return res.status(403).json({ message: "Forbidden - Platform Admin access required" });
    }
    next();
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
}

// Middleware: Trust & Safety - Primary workhorse for eligibility reviews
export async function isTrustSafety(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  try {
    const adminRole = await getUserAdminRole((req.user as any).id);
    // T&S or Platform Admin can access T&S routes
    if (adminRole !== 'trust_safety' && adminRole !== 'platform_admin') {
      return res.status(403).json({ message: "Forbidden - Trust & Safety access required" });
    }
    next();
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
}

// Middleware: Shelter Admin - Org-level admin for their own shelter
export async function isShelterAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  try {
    const adminRole = await getUserAdminRole((req.user as any).id);
    // Shelter Admin or Platform Admin can access shelter admin routes
    if (adminRole !== 'shelter_admin' && adminRole !== 'platform_admin') {
      return res.status(403).json({ message: "Forbidden - Shelter Admin access required" });
    }
    next();
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
}

// Middleware: AI Ops - Quality control for AI decisions
export async function isAiOps(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  try {
    const adminRole = await getUserAdminRole((req.user as any).id);
    // AI Ops or Platform Admin can access AI Ops routes
    if (adminRole !== 'ai_ops' && adminRole !== 'platform_admin') {
      return res.status(403).json({ message: "Forbidden - AI Ops access required" });
    }
    next();
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
}

// Middleware: Any Admin - Any of the admin roles
export async function isAnyAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  try {
    const user = await storage.getUser((req.user as any).id);
    const adminRole = (user?.adminRole as AdminRole) || null;
    const isLegacyAdmin = user?.isAdmin || (user as any)?.is_admin;
    
    // Accept any admin role or legacy isAdmin flag
    if (!adminRole && !isLegacyAdmin) {
      return res.status(403).json({ message: "Forbidden - Admin access required" });
    }
    next();
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
}

// Middleware: Trust & Safety or Platform Admin - for eligibility reviews
export async function canReviewEligibility(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  try {
    const adminRole = await getUserAdminRole((req.user as any).id);
    if (adminRole !== 'trust_safety' && adminRole !== 'platform_admin') {
      return res.status(403).json({ message: "Forbidden - Eligibility review access required" });
    }
    next();
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
}
