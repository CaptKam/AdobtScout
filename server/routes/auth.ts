import type { Express } from "express";
import passport from "passport";
import { storage } from "../storage";
import { hashPassword, validatePassword } from "../auth";

export function registerAuthRoutes(app: Express) {
  // Demo account endpoint
  app.post("/api/demo-login", async (req, res) => {
    try {
      const demoEmail = "demo@scout.app";
      const demoPassword = "Demo1234!";

      // Check if demo user exists
      let demoUser = await storage.getUserByEmail(demoEmail);

      // Create demo user if it doesn't exist
      if (!demoUser) {
        const hashedPassword = await hashPassword(demoPassword);
        demoUser = await storage.createUser({
          email: demoEmail,
          password: hashedPassword,
          firstName: "Demo",
          lastName: "User",
          role: "adopter",
        });

        // Create a demo profile with typical preferences - Dallas, TX
        await storage.createUserProfile({
          userId: demoUser.id,
          homeType: "house",
          hasYard: true,
          hasOtherPets: false,
          otherPetsType: null,
          activityLevel: "moderate",
          workSchedule: "hybrid",
          exerciseCommitment: "1-2 hours daily",
          experienceLevel: "some_experience",
          preferredSize: ["medium"],
          preferredAge: ["young_adult", "adult"],
          preferredEnergy: ["moderate"],
          householdComposition: "couple",
          searchRadius: 50,
          latitude: 32.7767, // Dallas, TX
          longitude: -96.7970,
          city: "Dallas",
          state: "TX",
        });
      } else {
        // Demo user exists - ensure profile is set to Dallas
        const existingProfile = await storage.getUserProfile(demoUser.id);
        if (existingProfile && (existingProfile.latitude !== 32.7767 || existingProfile.longitude !== -96.7970)) {
          await storage.updateUserProfile(demoUser.id, {
            latitude: 32.7767,
            longitude: -96.7970,
            city: "Dallas",
            state: "TX",
          });
        }
      }

      // Log in the demo user
      req.login(demoUser, (err) => {
        if (err) {
          return res.status(500).json({ message: "Login failed" });
        }
        res.json({
          id: demoUser!.id,
          email: demoUser!.email,
          role: demoUser!.role,
          firstName: demoUser!.firstName,
          lastName: demoUser!.lastName,
        });
      });
    } catch (error) {
      console.error("Demo login error:", error);
      res.status(500).json({ message: "Demo account creation failed" });
    }
  });

  // Login endpoint
  app.post('/api/login', (req, res, next) => {
    passport.authenticate('local', async (err: any, user: any, info: any) => {
      if (err) {
        return res.status(500).json({ message: "Internal server error" });
      }

      if (!user) {
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }

      req.login(user, (loginErr) => {
        if (loginErr) {
          return res.status(500).json({ message: "Login failed" });
        }

        res.json({
          id: user.id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
        });
      });
    })(req, res, next);
  });

  // Signup endpoint
  app.post('/api/signup', async (req, res) => {
    const { email, password, firstName, lastName, role = 'adopter' } = req.body;

    // Validate required fields
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Validate password strength
    const passwordResult = validatePassword(password);
    if (!passwordResult.valid) {
      return res.status(400).json({ message: passwordResult.message });
    }

    try {
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ message: "Email already in use" });
      }

      // Hash password and create user
      const hashedPassword = await hashPassword(password);
      const newUser = await storage.createUser({
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: (role as 'adopter' | 'shelter' | 'owner') || 'adopter',
      });

      // Log the user in
      req.login(newUser, (loginErr) => {
        if (loginErr) {
          return res.status(500).json({ message: "Failed to establish session after signup" });
        }

        res.json({
          id: newUser.id,
          email: newUser.email,
          role: newUser.role,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
        });
      });
    } catch (error: any) {
      console.error('Signup error:', error);
      res.status(500).json({ message: error.message || "Signup failed" });
    }
  });

  // Google OAuth routes
  app.get('/api/auth/google',
    (req, res, next) => {
      // Store intended role if provided in query params
      const intendedRole = req.query.intended_role as 'adopter' | 'shelter';
      if (intendedRole) {
        req.session.intendedRole = intendedRole;
      }
      next();
    },
    passport.authenticate('google', {
      scope: ['profile', 'email']
    })
  );

  app.get('/api/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req: any, res) => {
      // Successful authentication - check if this was a signup flow
      const intendedRole = req.session.intendedRole;

      if (intendedRole) {
        // Clear the intended role from session
        delete req.session.intendedRole;
        res.redirect('/onboarding');
      } else {
        // Regular login
        res.redirect('/onboarding');
      }
    }
  );

  // Apple OAuth routes (placeholder - requires Apple Developer setup)
  app.post('/api/auth/apple', async (req, res) => {
    res.status(501).json({
      message: 'Apple Sign In requires Apple Developer account configuration. Please set up Apple Sign In credentials.'
    });
  });

  // Admin login endpoint - validates admin status before establishing session
  app.post('/api/auth/admin-login', (req, res, next) => {
    passport.authenticate('local', async (err: any, user: any, info: any) => {
      if (err) {
        console.error("[Admin Login] Authentication error:", err);
        return res.status(500).json({ message: "Internal server error" });
      }

      if (!user) {
        console.log("[Admin Login] Failed - Invalid credentials");
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Debug logging to see what Passport returned
      console.log("[Admin Login] User object from Passport:", {
        email: user.email,
        role: user.role,
        has_isAdmin: 'isAdmin' in user,
        has_is_admin: 'is_admin' in user,
        isAdmin_value: user.isAdmin,
        is_admin_value: (user as any).is_admin,
        all_keys: Object.keys(user)
      });

      // Verify admin status and active status before allowing login
      // Check both camelCase and snake_case due to DB/type inconsistencies
      const isAdmin = user.isAdmin || (user as any).is_admin;
      const isActive = user.isActive || (user as any).is_active;

      if (!isAdmin) {
        console.log("[Admin Login] Rejected - User is not an admin:", { email: user.email, userId: user.id, isAdmin, is_admin: (user as any).is_admin });
        return res.status(403).json({ message: "Access denied. Admin privileges required." });
      }

      if (!isActive) {
        console.log("[Admin Login] Rejected - Admin account is inactive:", { email: user.email, userId: user.id });
        return res.status(403).json({ message: "Account is inactive. Please contact support." });
      }

      // Log successful admin login for audit trail
      console.log("[Admin Login] Success:", {
        userId: user.id,
        email: user.email,
        ip: req.ip,
        timestamp: new Date().toISOString()
      });

      // Establish admin session
      req.login(user, (loginErr) => {
        if (loginErr) {
          console.error("[Admin Login] Session creation failed:", loginErr);
          return res.status(500).json({ message: "Login failed" });
        }

        res.json({
          id: user.id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          isAdmin: user.isAdmin,
        });
      });
    })(req, res, next);
  });

  // Shelter login endpoint - validates shelter role before establishing session
  app.post('/api/auth/shelter-login', (req, res, next) => {
    passport.authenticate('local', async (err: any, user: any, info: any) => {
      if (err) {
        console.error("[Shelter Login] Authentication error:", err);
        return res.status(500).json({ message: "Internal server error" });
      }

      if (!user) {
        console.log("[Shelter Login] Failed - Invalid credentials");
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Verify shelter role before allowing login
      if (user.role !== 'shelter') {
        console.log("[Shelter Login] Rejected - User is not a shelter:", { email: user.email, userId: user.id, role: user.role });
        return res.status(403).json({ message: "Access denied. This login is for shelter accounts only." });
      }

      // Check if account is active
      const isActive = user.isActive || (user as any).is_active;
      if (isActive === false) {
        console.log("[Shelter Login] Rejected - Shelter account is inactive:", { email: user.email, userId: user.id });
        return res.status(403).json({ message: "Account is inactive. Please contact support." });
      }

      // Log successful shelter login
      console.log("[Shelter Login] Success:", {
        userId: user.id,
        email: user.email,
        role: user.role,
        ip: req.ip,
        timestamp: new Date().toISOString()
      });

      // Establish shelter session
      req.login(user, (loginErr) => {
        if (loginErr) {
          console.error("[Shelter Login] Session creation failed:", loginErr);
          return res.status(500).json({ message: "Login failed" });
        }

        res.json({
          id: user.id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
        });
      });
    })(req, res, next);
  });

  app.post('/api/logout', (req, res) => {
    req.logout((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Failed to logout" });
      }
      req.session.destroy((destroyErr) => {
        if (destroyErr) {
          console.error("Session destroy error:", destroyErr);
          return res.status(500).json({ message: "Failed to destroy session" });
        }
        res.clearCookie('connect.sid');
        res.json({ message: "Logged out successfully" });
      });
    });
  });
}
